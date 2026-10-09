"""
Thin API layer over the existing SignalTriage logic.

Nothing about metrics.py, analytics.py, data_loader.py, or api_client.py
changes -- this file just imports them and exposes their results as JSON,
so a React frontend (running in the browser) can call them over HTTP.

Run with: uvicorn api_server:app --reload --port 8000
"""
import sys
from pathlib import Path

# Ensure the package directory is on sys.path regardless of how/where uvicorn is launched
PACKAGE_DIR = Path(__file__).parent.resolve()
if str(PACKAGE_DIR) not in sys.path:
    sys.path.insert(0, str(PACKAGE_DIR))

import threading
import time
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

from data_loader import get_drug_report_data, load_background_rates, SUPPORTED_DRUGS
from analytics import (
    build_signal_table,
    build_signal_table_live,
    build_reaction_trend,
    prepare_trend_frame,
)
from api_client import (
    fetch_openfda_reports,
    normalize_records,
    fetch_reaction_counts_for_drug,
    fetch_background_reaction_counts,
)
from briefing import build_template_briefing, build_ai_briefing

app = FastAPI(title="SignalTriage API")

# The all-drug baseline is identical for every drug and shifts only as FAERS
# itself is refreshed, so re-downloading a 500-term histogram plus a corpus
# total on every analysis is pure waste. An hour is well inside the window in
# which a 20-million-report denominator is stable.
BACKGROUND_TTL_SECONDS = 3600
_background_cache = {"data": None, "fetched_at": 0.0}
_background_lock = threading.Lock()


def _resolve(future, label):
    """
    A parallel fetch's result, or None.

    Every fetch function already returns None rather than raising, so this is
    belt-and-braces -- but a stray exception surfacing through .result() would
    500 the endpoint instead of falling back, which is precisely the behaviour
    the fallback exists to prevent.
    """
    try:
        return future.result()
    except Exception as exc:
        print(f"[TIMING] {label} failed: {exc!r}", file=sys.stderr)
        return None


def get_background_counts():
    """Cached all-drug comparator, falling back to the last good copy."""
    now = time.time()
    cached = _background_cache["data"]
    if cached and (now - _background_cache["fetched_at"]) < BACKGROUND_TTL_SECONDS:
        return cached

    # uvicorn runs sync endpoints on a threadpool, so two analyses arriving at
    # once could both find the cache cold and both pay the ~7s fetch. The lock
    # makes the second wait for the first and then take the cache hit.
    with _background_lock:
        cached = _background_cache["data"]
        if cached and (time.time() - _background_cache["fetched_at"]) < BACKGROUND_TTL_SECONDS:
            return cached

        fresh = fetch_background_reaction_counts()
        if fresh:
            _background_cache["data"] = fresh
            _background_cache["fetched_at"] = time.time()
            return fresh

    # A stale real baseline still beats dropping to the synthetic one; the
    # all-drug rates do not meaningfully move between refreshes.
    return cached

# Allows the React dev server (running on a different port) to call this API.
# In a real production deployment this would be locked to a specific domain
# instead of "*" -- fine for a local prototype demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/drugs")
def list_supported_drugs():
    """The 3 pre-tested drugs with guaranteed cached fallback data."""
    return {"drugs": SUPPORTED_DRUGS}


@app.get("/api/analyze")
def analyze(
    drug: str = Query(..., description="Generic drug name, e.g. metformin"),
    live: bool = Query(True, description="Try the live openFDA API first"),
    limit: int = Query(100, ge=50, le=500),
):
    """
    This does exactly what app.py's Streamlit version did on the "Analyze"
    button click -- same functions, same logic -- just returns JSON
    instead of drawing a page.
    """
    clean_drug = drug.strip()
    notes = []
    signal_table = None
    data_mode = None
    report_df = pd.DataFrame()
    total_reports = 0

    request_started = time.perf_counter()
    raw_records = None

    # --- Preferred path: real counts for both sides of the ratio ---
    if live:
        # These three fetches need nothing from each other, and the endpoint
        # spends essentially all its time waiting on the network rather than
        # computing, so running them together collapses the wait to the slowest
        # one instead of the sum. requests is blocking, so threads are the right
        # tool -- there is no reason to make the whole app async for this.
        with ThreadPoolExecutor(max_workers=3) as pool:
            drug_future = pool.submit(fetch_reaction_counts_for_drug, clean_drug)
            background_future = pool.submit(get_background_counts)
            raw_future = pool.submit(fetch_openfda_reports, clean_drug, limit)

            drug_counts = _resolve(drug_future, "drug counts")
            background = _resolve(background_future, "background")
            raw_records = _resolve(raw_future, "raw reports")

        if drug_counts and background:
            signal_table = build_signal_table_live(
                drug_counts["reaction_counts"],
                drug_counts["total_drug_reports"],
                background["background_counts"],
                background["background_total"],
            )
            data_mode = "Live API (real comparator)"
            # The count endpoint gives totals, not rows, so the true corpus
            # size comes from it rather than from the sampled DataFrame.
            total_reports = int(drug_counts["total_drug_reports"])

            # Demographics and trends need per-report fields the count endpoint
            # does not expose, so they come from the raw sample fetched above.
            rows = normalize_records(raw_records, clean_drug.lower()) if raw_records else []
            report_df = pd.DataFrame(rows)

            if report_df.empty:
                notes.append(
                    "Demographics and trends unavailable: the raw report fetch "
                    "failed. Ratios are unaffected."
                )
            else:
                notes.append(
                    f"Ratios use all {total_reports:,} FAERS reports for this drug. "
                    f"Demographics and trends are from a sample of "
                    f"{int(report_df['report_id'].nunique()):,}."
                )

    # --- Fallback: the original synthetic-comparator path, unchanged ---
    if signal_table is None:
        report_df, source_mode = get_drug_report_data(clean_drug, live, limit=limit)
        background_df = load_background_rates()

        if report_df.empty:
            return {
                "error": f"No matching records were retrieved for '{clean_drug}'.",
                "data_mode": source_mode,
            }

        signal_table = build_signal_table(report_df, background_df)
        total_reports = int(report_df["report_id"].nunique())

        # Naming the comparator matters here. Reports can be live while the
        # background rates are still the synthetic CSV, and calling that
        # "Cached demo data" would misreport where the data came from.
        data_mode = (
            "Live API (cached comparator)"
            if source_mode == "Live API"
            else source_mode
        )
        # Only frame this as a failure when the live comparator was actually
        # asked for; with live off it is simply the chosen mode.
        notes.append(
            "Live comparator unavailable; background rates come from the "
            "fixed offline sample."
            if live
            else "Live mode off; background rates come from the fixed offline sample."
        )

    review_priority_count = int((signal_table["triage_label"] == "Review priority").sum())
    top_reaction = (
        signal_table.sort_values("drug_event_count", ascending=False).iloc[0]["reaction_term"]
        if not signal_table.empty else None
    )

    # Clean DataFrame records so all NaNs become valid Python None for JSON
    clean_signal_table = [
        {k: (None if pd.isna(v) else v) for k, v in record.items()}
        for record in signal_table.to_dict(orient="records")
    ]

    # Both of these read per-report fields, which the live count path does not
    # return. When the raw sample is missing they degrade to empty rather than
    # raising -- the ratios above stand on their own.
    if report_df.empty:
        demographics = {"sex": {}, "age_group": {}, "serious": {}}
        trends = {row["reaction_term"]: build_reaction_trend(report_df, row["reaction_term"])
                  for row in clean_signal_table}
    else:
        demo_df = report_df.drop_duplicates(subset="report_id")
        demographics = {
            "sex": {str(k): int(v) for k, v in demo_df["sex"].value_counts().items() if pd.notna(k)},
            "age_group": {str(k): int(v) for k, v in demo_df["age_group"].value_counts().items() if pd.notna(k)},
            "serious": {str(k): int(v) for k, v in demo_df["serious"].value_counts().items() if pd.notna(k)},
        }

        # Year trend per reaction, keyed by reaction term so the UI can look up
        # whichever row the analyst has selected without a second request.
        prepared_trends = prepare_trend_frame(report_df)
        trends = {
            row["reaction_term"]: build_reaction_trend(
                report_df, row["reaction_term"], prepared=prepared_trends
            )
            for row in clean_signal_table
        }

    # Narrates the table that was just computed. The model gets first refusal
    # and the template is the floor -- no key, no network, a retired model or
    # output that broke the causal-language rule all land in the same place.
    briefing = build_ai_briefing(clean_drug, clean_signal_table, trends)
    briefing_source = "gemini" if briefing else "template"
    if not briefing:
        briefing = build_template_briefing(clean_drug, clean_signal_table, trends)

    print(
        f"[TIMING] TOTAL /api/analyze ({clean_drug}, live={live}): "
        f"{time.perf_counter() - request_started:.2f}s",
        file=sys.stderr,
    )

    return {
        "drug": clean_drug,
        "data_mode": data_mode,
        "total_reports": total_reports,
        "distinct_reactions": int(signal_table["reaction_term"].nunique()),
        "review_priority_count": review_priority_count,
        "top_reaction": top_reaction,
        "signal_table": clean_signal_table,
        "demographics": demographics,
        "trends": trends,
        "notes": notes,
        "briefing": briefing,
        "briefing_source": briefing_source,
    }
