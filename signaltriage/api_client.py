"""
Talks to the live openFDA API. No API key is required -- it's a free,
public endpoint. Every function here fails safely: if anything goes
wrong (timeout, bad response, network error), it returns None instead
of raising, so app.py can cleanly fall back to cached demo data.
"""
import requests

BASE_URL = "https://api.fda.gov/drug/event.json"
TIMEOUT_SECONDS = 8
REACTION_COUNT_FIELD = "patient.reaction.reactionmeddrapt.exact"
# 500 is the ceiling for a keyless request: limit=1000 returns HTTP 403
# ("No api_key was supplied"), and this project is deliberately key-free.
COUNT_LIMIT = 500


def _normalise_term(term):
    """
    Mirrors the casing rule inside normalize_records so that keys coming from
    the count endpoint line up with keys built from raw reports. Duplicated
    rather than shared because normalize_records is deliberately left alone.
    """
    term = str(term).strip()
    return term.title() if term.isupper() else term


def _fetch_total(params):
    """
    meta.results.total for a query -- the number of matching *reports*.

    This has to be a separate request: a count response tells you how often
    each reaction appears, and summing those overcounts badly because one
    report lists several reactions. For PRR the denominator must be reports.
    """
    try:
        response = requests.get(
            BASE_URL, params={**params, "limit": 1}, timeout=TIMEOUT_SECONDS
        )
        response.raise_for_status()
        total = response.json().get("meta", {}).get("results", {}).get("total")
        return int(total) if total is not None else None
    except (requests.exceptions.RequestException, ValueError, TypeError):
        return None


def _fetch_reaction_counts(params):
    """
    Per-reaction report counts for whatever the params select.

    The explicit limit matters: openFDA defaults count queries to 100 terms,
    which is nowhere near enough for a comparator. Any reaction missing from
    the background histogram gets c=0 and falls out as "Comparator
    unavailable", so a 100-term baseline would silently strand most of a
    drug's rarer reactions -- exactly the ones worth triaging.
    """
    try:
        response = requests.get(
            BASE_URL,
            params={**params, "count": REACTION_COUNT_FIELD, "limit": COUNT_LIMIT},
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        results = response.json().get("results", []) or []

        counts = {}
        for entry in results:
            term = entry.get("term")
            count = entry.get("count")
            if not term or count is None:
                continue
            counts[_normalise_term(term)] = int(count)
        return counts or None
    except (requests.exceptions.RequestException, ValueError, TypeError):
        return None


def fetch_reaction_counts_for_drug(drug_name):
    """
    Real per-reaction report counts for one drug, straight from FAERS.

    This is the 'a' and 'a+b' of the PRR calculation measured rather than
    sampled: the count endpoint aggregates over every matching report, not
    just the first hundred a raw fetch would return.

    Returns {"reaction_counts": {...}, "total_drug_reports": int} or None.
    """
    search = f'patient.drug.openfda.generic_name.exact:"{drug_name.upper()}"'

    counts = _fetch_reaction_counts({"search": search})
    if counts is None:
        return None

    total = _fetch_total({"search": search})
    if total is None:
        return None

    return {"reaction_counts": counts, "total_drug_reports": total}


def fetch_background_reaction_counts():
    """
    The comparator: how often each reaction is reported across ALL drugs.

    This is 'c' and 'c+d' -- the denominator the whole tool used to invent.
    Unfiltered, so it covers the entire FAERS corpus.

    Returns {"background_counts": {...}, "background_total": int} or None.
    """
    counts = _fetch_reaction_counts({})
    if counts is None:
        return None

    total = _fetch_total({})
    if total is None:
        return None

    return {"background_counts": counts, "background_total": total}


def fetch_openfda_reports(drug_name, limit=100):
    """
    Fetches up to `limit` raw FAERS report records for a given generic
    drug name. Returns a list of raw JSON records, or None on any failure.
    """
    query = f'patient.drug.openfda.generic_name.exact:"{drug_name.upper()}"'
    params = {"search": query, "limit": limit}

    try:
        response = requests.get(BASE_URL, params=params, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()
        payload = response.json()
        return payload.get("results", [])
    except (requests.exceptions.RequestException, ValueError):
        # ValueError covers a malformed / non-JSON response.
        # Any failure here just means "couldn't get live data" --
        # app.py decides what to do next (fall back to demo mode).
        return None


def normalize_records(raw_records, drug_name):
    """
    Converts openFDA's raw nested JSON into the same flat row structure
    as our demo CSVs, so the rest of the app (metrics, charts) doesn't
    need to know whether the data came from the live API or a cache file.

    One row per (report, reaction) pair, matching how the demo data is
    structured -- this keeps the aggregation logic identical either way.
    """
    rows = []
    for record in raw_records:
        report_id = record.get("safetyreportid", "unknown")
        serious_val = str(record.get("serious", "")).strip()
        serious = "Yes" if serious_val == "1" else "No"
        year = None
        receive_date = record.get("receivedate")
        if receive_date and len(receive_date) >= 4:
            year = receive_date[:4]

        patient = record.get("patient", {}) or {}
        sex_code = str(patient.get("patientsex", "")).strip()
        sex = {"1": "Male", "2": "Female"}.get(sex_code, "Unknown")

        age = patient.get("patientonsetage")
        try:
            age = int(float(age)) if age is not None else None
        except (ValueError, TypeError):
            age = None
        age_group = _age_group(age) if age is not None else "Unknown"

        reactions = patient.get("reaction", []) or []
        # A report can list the same reaction twice -- count it once per report.
        seen_terms = set()
        for reaction in reactions:
            term = reaction.get("reactionmeddrapt")
            if not term:
                continue
            term = term.strip()
            if term.isupper():
                term = term.title()
            if term in seen_terms:
                continue
            seen_terms.add(term)

            rows.append({
                "report_id": report_id,
                "drug_name": drug_name,
                "reaction_term": term,
                "serious": serious,
                "sex": sex,
                "age": age,
                "age_group": age_group,
                "report_year": year,
                "source_mode": "live_api",
            })

        if not reactions:
            rows.append({
                "report_id": report_id, "drug_name": drug_name,
                "reaction_term": "Other/unspecified", "serious": serious,
                "sex": sex, "age": age, "age_group": age_group,
                "report_year": year, "source_mode": "live_api",
            })

    return rows


def _age_group(age):
    if age is None:
        return "Unknown"
    if age < 18:
        return "<18"
    bands = [(18, 30), (31, 45), (46, 60), (61, 75), (76, 90)]
    for lo, hi in bands:
        if lo <= age <= hi:
            return f"{lo}-{hi}"
    if age > 90:
        return ">90"
    return "Unknown"
