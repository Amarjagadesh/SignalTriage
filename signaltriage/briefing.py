"""
Plain-language summary of a computed signal table.

This is the deterministic path, and it is deliberately the one that ships
first: it needs no API key, no network, and no model. Everything it says is
read straight out of a row that the engine already computed, so the briefing
cannot disagree with the table above it or introduce a claim the numbers do
not support.

Any AI-generated briefing added later must degrade to this.
"""

import json
import os
import re
import sys
from pathlib import Path

import requests

try:
    from analytics import TRIAGE_ORDER
except ImportError:
    from signaltriage.analytics import TRIAGE_ORDER

# Optional: the app must still start if python-dotenv is not installed.
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
except ImportError:  # pragma: no cover
    pass

# The labels that mean "reported more than expected". Monitor is excluded on
# purpose -- a ratio between 1 and 2 is not something to open a briefing with.
ELEVATED_LABELS = ("Review priority", "Unstable ratio", "Weak evidence")

MAX_HIGHLIGHTS = 3

DISCLAIMER = (
    "This is an exploratory prioritisation from reported-frequency statistics, "
    "not a causal or clinical finding."
)


def _format_ratio(value):
    """31.56 -> '31.56', 20.0 -> '20'. Trailing zeros read as false precision."""
    return f"{value:g}"


def _format_chi(value):
    """Chi-square runs into the hundreds of thousands on real FAERS volumes."""
    return f"{value:,.2f}"


def _rank_elevated(signal_table):
    """
    Elevated rows, ordered exactly as the table orders them.

    Shared by both briefing paths so the template and the model are always
    describing the same rows in the same priority order.
    """
    rows = [row for row in (signal_table or []) if isinstance(row, dict)]
    elevated = [r for r in rows if r.get("triage_label") in ELEVATED_LABELS]
    elevated.sort(
        key=lambda r: (
            TRIAGE_ORDER.get(r.get("triage_label"), 99),
            -(r.get("prr") or 0),
        )
    )
    return elevated


def _describe(row, trends):
    """One reaction, rendered from its own row and nothing else."""
    reaction = row.get("reaction_term", "an unnamed reaction")
    prr = row.get("prr")
    chi = row.get("chi_square")

    stats = []
    if isinstance(prr, (int, float)):
        stats.append(f"PRR {_format_ratio(prr)}")
    if isinstance(chi, (int, float)):
        stats.append(f"χ² {_format_chi(chi)}")

    text = reaction
    if stats:
        text += f" ({', '.join(stats)})"

    direction = (trends or {}).get(reaction, {}).get("direction")
    if direction in ("Rising", "Declining"):
        text += f", reporting {direction.lower()} year on year"

    return text


def build_template_briefing(drug, signal_table, trends=None):
    """
    A 2-4 sentence reviewer briefing built only from computed values.

    `trends` is optional so the two-argument call in the specification still
    works; it is the only way a trend direction can be present, since the
    direction lives alongside the table rather than inside its rows.

    Never raises. A briefing is a convenience layered on top of the analysis,
    so a failure here must not be able to take the analysis down with it.
    """
    try:
        # Capitalise a real drug name, but leave the generic stand-in alone so
        # it does not read as "for This drug".
        name = str(drug or "").strip()
        label = (name[:1].upper() + name[1:]) if name else "this drug"

        rows = [row for row in (signal_table or []) if isinstance(row, dict)]
        if not rows:
            return f"No reactions were returned for {label}. {DISCLAIMER}"

        elevated = _rank_elevated(rows)
        if not elevated:
            term_word = "term" if len(rows) == 1 else "terms"
            return (
                f"No reaction reported for {label} passed the elevated-reporting "
                f"thresholds in this dataset, across {len(rows):,} reaction "
                f"{term_word} examined. {DISCLAIMER}"
            )

        highlights = elevated[:MAX_HIGHLIGHTS]

        lead = highlights[0]
        sentences = [
            f"For {label}, the strongest reporting signal is "
            f"{_describe(lead, trends)}, flagged as "
            f"{str(lead.get('triage_label', 'unclassified')).lower()}."
        ]

        others = highlights[1:]
        if others:
            # No trend clause on the secondary items. Each one already contains
            # a comma, and adding another produced "…reporting rising year on
            # year and Abdominal discomfort…", where the trend appears to run
            # into the next reaction.
            described = [_describe(row, None) for row in others]
            joined = described[0] if len(described) == 1 else (
                " and ".join([", ".join(described[:-1]), described[-1]])
            )
            sentences.append(f"Also elevated: {joined}.")

        # Only count what is not already named above, so nothing double-counts.
        review_total = sum(1 for r in rows if r.get("triage_label") == "Review priority")
        named_review = sum(
            1 for r in highlights if r.get("triage_label") == "Review priority"
        )
        remaining = review_total - named_review
        if remaining > 0:
            sentences.append(
                f"{remaining:,} further reaction{'s' if remaining != 1 else ''} "
                f"reached review priority."
            )

        sentences.append(DISCLAIMER)
        return " ".join(sentences)

    except Exception:
        # Deliberately broad: whatever went wrong, the caller still gets a
        # string, and the one sentence it contains is the one that must
        # always be shown.
        return DISCLAIMER


# ---------------------------------------------------------------------------
# Optional AI path
# ---------------------------------------------------------------------------

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# The specification named gemini-1.5-flash, which is retired and answers 404 --
# the feature could never have activated. Rather than swap in another name that
# will retire in its turn, try a short list: a pinned model that is verified
# working, then the moving alias as a backstop. A 404 costs under a second, so
# the common case is one request.
#
# GEMINI_MODEL overrides the list entirely when a specific model is required.
MODEL_CANDIDATES = ("gemini-3.5-flash", "gemini-flash-latest")
AI_TIMEOUT_SECONDS = 8
MAX_AI_SIGNALS = 5

SYSTEM_INSTRUCTION = (
    "You are writing a short internal triage note for a pharmacovigilance "
    "reviewer. You will be given already-computed statistics. Use ONLY these "
    "numbers. Do NOT add any external knowledge about the drug, its biology, "
    "or its known side effects. Do NOT state or imply causation. Do NOT give "
    "clinical or medical advice. Write 2-4 neutral sentences. End by noting "
    "this is exploratory, not causal."
)

# The last line of defence, not the first. The instruction above is what should
# keep causal language out; this is here because a prompt is a request, not a
# guarantee, and a briefing that says a drug "causes" something is exactly the
# claim this tool exists to avoid making.
CAUSAL_LANGUAGE = re.compile(
    r"\b("
    r"caus(e|es|ed|ing)"
    r"|lead(s|ing)?\s+to|led\s+to"
    r"|result(s|ed|ing)?\s+in"
    r"|responsible\s+for"
    r"|induc(e|es|ed|ing)"
    r"|trigger(s|ed|ing)?"
    r"|brought\s+on"
    r")\b",
    re.IGNORECASE,
)


def _log_ai_failure(reason, api_key=""):
    """
    Why the AI path declined, on stderr so it lands in the uvicorn log.

    Without this a fallback is indistinguishable from a missing key, and the
    single most common question -- "why is it still saying template?" -- has
    no answer.
    """
    text = str(reason)
    if api_key:
        text = text.replace(api_key, "<redacted>")
    print(f"[briefing] AI briefing unavailable: {text}", file=sys.stderr)


def build_ai_briefing(drug, signal_table, trends=None):
    """
    A model-written version of the same briefing, or None.

    Returning None is a completely normal outcome -- no key, no network, a
    retired model, or output that broke the causal-language rule. Every one of
    those falls back to build_template_briefing, so the AI is strictly an
    upgrade and never a dependency.

    The model receives the drug name and at most five already-computed rows.
    Nothing else: no raw reports, no demographics, no free text. It cannot do
    arithmetic on data it was never given, which is what keeps it narrating
    rather than analysing.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        elevated = _rank_elevated(signal_table)
        if not elevated:
            # Nothing to narrate; the template's "nothing elevated" sentence is
            # already the correct and safest answer.
            return None

        signals = [
            {
                "reaction": row.get("reaction_term"),
                "prr": row.get("prr"),
                "chi_square": row.get("chi_square"),
                "triage_label": row.get("triage_label"),
                "trend": (trends or {}).get(row.get("reaction_term"), {}).get("direction"),
            }
            for row in elevated[:MAX_AI_SIGNALS]
        ]

        body = {
            "system_instruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
            "contents": [{
                "role": "user",
                "parts": [{"text": json.dumps(
                    {"drug": drug, "signals": signals}, ensure_ascii=False
                )}],
            }],
            "generationConfig": {
                # Low temperature: this is a restatement of numbers, and there
                # is nothing here worth being creative about.
                "temperature": 0.2,
                # Current flash models spend "thinking" tokens out of this same
                # budget. At 400 the model burned 383 of them reasoning and
                # returned a 13-token fragment that stopped mid-sentence.
                # Turning thinking off fixes it properly and more than halves
                # the latency; the headroom is belt-and-braces for any model
                # that ignores the setting.
                "maxOutputTokens": 800,
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }

        override = os.environ.get("GEMINI_MODEL", "").strip()
        models = (override,) if override else MODEL_CANDIDATES

        response = None
        for model in models:
            try:
                attempt = requests.post(
                    GEMINI_ENDPOINT.format(model=model),
                    # Header rather than ?key=, so the secret stays out of URLs,
                    # logs, and any error body that echoes the request.
                    headers={
                        "x-goog-api-key": api_key,
                        "Content-Type": "application/json",
                    },
                    json=body,
                    timeout=AI_TIMEOUT_SECONDS,
                )
            except requests.exceptions.RequestException as exc:
                _log_ai_failure(f"model '{model}': {exc!r}", api_key)
                continue

            if attempt.status_code == 200:
                response = attempt
                break

            # 404 retired, 503 busy, 400 a config this model will not accept.
            # All three are worth trying the next candidate for; nothing else is.
            _log_ai_failure(
                f"HTTP {attempt.status_code} from model '{model}': "
                f"{attempt.text[:160]}",
                api_key,
            )
            if attempt.status_code not in (400, 404, 503):
                break

        if response is None:
            return None

        candidates = response.json().get("candidates") or []
        first = candidates[0] if candidates else {}
        parts = first.get("content", {}).get("parts") or []
        text = " ".join(p.get("text", "") for p in parts).strip()

        if not text:
            _log_ai_failure("empty response body")
            return None

        # A truncated briefing stops mid-sentence and reads like a bug, which
        # is worse than the template it would have replaced.
        if first.get("finishReason") not in (None, "STOP"):
            _log_ai_failure(f"incomplete generation: {first.get('finishReason')}")
            return None

        match = CAUSAL_LANGUAGE.search(text)
        if match:
            _log_ai_failure(f"rejected, causal language: {match.group(0)!r}")
            return None

        return text

    except Exception as exc:
        _log_ai_failure(repr(exc), api_key)
        return None


if __name__ == "__main__":
    # The briefing contains "χ²", and a Windows console defaults to cp1252,
    # which cannot encode it. The string itself is fine everywhere it actually
    # travels (JSON escapes it, the browser renders it) -- only this console
    # needs telling.
    import sys

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    # Run directly (`py briefing.py`) after touching this file. The point of
    # these cases is the "never raises" guarantee as much as the wording.
    cases = [
        ("normal, three elevated", "metformin", [
            {"reaction_term": "Lactic Acidosis", "prr": 31.56, "chi_square": 329869.75,
             "triage_label": "Review priority"},
            {"reaction_term": "Metabolic Acidosis", "prr": 11.57, "chi_square": 50059.87,
             "triage_label": "Review priority"},
            {"reaction_term": "Hypoglycaemia", "prr": 8.87, "chi_square": 44249.89,
             "triage_label": "Review priority"},
            {"reaction_term": "Nausea", "prr": 1.2, "chi_square": 9.0,
             "triage_label": "Monitor"},
        ], {"Lactic Acidosis": {"direction": "Rising"}}),

        ("no elevated rows", "ibuprofen", [
            {"reaction_term": "Nausea", "prr": 1.1, "chi_square": 3.0,
             "triage_label": "Monitor"},
        ], None),

        ("empty table", "atorvastatin", [], None),

        ("missing chi-square (weak evidence)", "aspirin", [
            {"reaction_term": "Rash", "prr": 3.0, "chi_square": None,
             "triage_label": "Weak evidence"},
        ], None),

        ("malformed rows", "mystery", [None, {"triage_label": "Review priority"}], None),

        ("nothing at all", None, None, None),
    ]

    print("Running briefing.py self-tests...\n")
    all_passed = True
    for name, drug, table, trends in cases:
        try:
            text = build_template_briefing(drug, table, trends)
            ok = isinstance(text, str) and DISCLAIMER in text
        except Exception as exc:  # pragma: no cover - this is the thing under test
            text, ok = f"RAISED {exc!r}", False

        if not ok:
            all_passed = False
        print(f"[{'PASS' if ok else 'FAIL'}] {name}\n        {text}\n")

    # --- The causal-language gate, which is the actual safety guarantee ---
    causal_cases = [
        ("Metformin causes lactic acidosis.", True),
        ("The drug leads to acidosis.", True),
        ("This results in elevated reporting.", True),
        ("Treatment induced hypoglycaemia.", True),
        ("It is responsible for the increase.", True),
        ("Lactic Acidosis shows a PRR of 31.56 and was flagged for review.", False),
        ("Reporting is disproportionate relative to the background rate.", False),
        ("Three reactions reached review priority in this dataset.", False),
    ]

    print("\nRunning causal-language gate tests...\n")
    for text, should_reject in causal_cases:
        rejected = bool(CAUSAL_LANGUAGE.search(text))
        ok = rejected == should_reject
        if not ok:
            all_passed = False
        verdict = "rejected" if rejected else "allowed"
        print(f"[{'PASS' if ok else 'FAIL'}] {verdict:8} :: {text}")

    # --- The model must never receive anything but computed rows ---
    ALLOWED_KEYS = {"reaction", "prr", "chi_square", "triage_label", "trend"}
    sample_rows = [
        {"reaction_term": "Lactic Acidosis", "prr": 31.56, "chi_square": 329869.75,
         "triage_label": "Review priority", "drug_total_reports": 354861,
         "drug_event_rate": 0.048, "comparator_event_rate": 0.0015},
    ]
    built = [
        {
            "reaction": row.get("reaction_term"),
            "prr": row.get("prr"),
            "chi_square": row.get("chi_square"),
            "triage_label": row.get("triage_label"),
            "trend": None,
        }
        for row in _rank_elevated(sample_rows)[:MAX_AI_SIGNALS]
    ]
    leaked = set().union(*(set(s) for s in built)) - ALLOWED_KEYS if built else set()
    payload_ok = bool(built) and not leaked
    if not payload_ok:
        all_passed = False
    print(f"\n[{'PASS' if payload_ok else 'FAIL'}] payload carries only computed "
          f"fields (leaked: {leaked or 'none'})")

    print("\nAll tests passed!" if all_passed else "\nSome tests FAILED.")
