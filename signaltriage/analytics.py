"""
Turns a flat DataFrame of (report, reaction) rows into the signal-triage
table: one row per reaction term, with its PRR-inspired ratio and label.
"""
import pandas as pd
try:
    from metrics import calculate_prr, assign_triage, calculate_chi_square
except ImportError:
    from signaltriage.metrics import calculate_prr, assign_triage, calculate_chi_square


MIN_REPORTS_PER_YEAR = 10
MIN_YEARS_FOR_DIRECTION = 3
TREND_CHANGE_THRESHOLD = 0.25


def _empty_trend():
    return {
        "years": [], "rates": [], "counts": [], "totals": [],
        "thin_years": [], "direction": "Insufficient history",
    }


def prepare_trend_frame(report_df):
    """
    The part of the trend calculation that is identical for every reaction:
    normalising years, and counting reports per year overall and per reaction.

    Hoisting this out matters. Done inside build_reaction_trend it is redone
    once per reaction, and a live pull has a couple of hundred of them -- that
    measured at 1.3 seconds of pure repeat work on every analysis. Computed
    once here it is a single pass, and each reaction becomes a dict lookup.

    Returns None when the frame carries no usable years.
    """
    if report_df.empty or "report_year" not in report_df.columns:
        return None

    df = report_df.dropna(subset=["report_year"]).copy()
    if df.empty:
        return None

    # Live API years arrive as strings, cached CSV years as integers.
    df["_year"] = df["report_year"].astype(str).str.strip().str[:4]
    df = df[df["_year"].str.fullmatch(r"\d{4}", na=False)]
    if df.empty:
        return None

    totals_by_year = df.groupby("_year")["report_id"].nunique()
    counts_by_reaction_year = (
        df.groupby(["reaction_term", "_year"])["report_id"].nunique()
    )
    return totals_by_year, counts_by_reaction_year


def build_reaction_trend(report_df, reaction_term, prepared=None):
    """
    How often a reaction was reported for this drug, year by year.

    The value is the *rate*, not the raw count: report volume for a drug rises
    and falls for reasons that have nothing to do with safety (media coverage,
    a label change, more prescriptions), and a rising count against a rising
    denominator is not a signal. Dividing by that year's total controls for it.

    Years with very few reports are excluded from the direction call rather
    than plotted as dramatic swings -- one extra report out of three is a 33%
    jump that means nothing. They are returned in "thin_years" so the UI can
    say why a year is missing instead of silently dropping it.

    `prepared` is the optional result of prepare_trend_frame, passed in when
    building trends for many reactions at once. Omit it and the function is
    fully self-contained.

    Returns {"years", "rates", "counts", "totals", "thin_years", "direction"}.
    """
    if prepared is None:
        prepared = prepare_trend_frame(report_df)
    if prepared is None:
        return _empty_trend()

    totals_by_year, counts_by_reaction_year = prepared
    try:
        counts_by_year = counts_by_reaction_year.loc[reaction_term]
    except KeyError:
        counts_by_year = {}

    years, rates, counts, totals, thin_years = [], [], [], [], []
    for year in sorted(totals_by_year.index):
        total = int(totals_by_year[year])
        count = int(counts_by_year.get(year, 0))

        if total < MIN_REPORTS_PER_YEAR:
            thin_years.append(year)
            continue

        years.append(year)
        counts.append(count)
        totals.append(total)
        rates.append(round(count / total, 4))

    direction = _trend_direction(rates)

    return {
        "years": years,
        "rates": rates,
        "counts": counts,
        "totals": totals,
        "thin_years": thin_years,
        "direction": direction,
    }


def _trend_direction(rates):
    """Compares the two most recent years against the two earliest."""
    if len(rates) < MIN_YEARS_FOR_DIRECTION:
        return "Insufficient history"

    earliest = sum(rates[:2]) / 2
    recent = sum(rates[-2:]) / 2

    if earliest == 0:
        # Going from nothing to something is a rise; nothing to nothing is not.
        return "Rising" if recent > 0 else "Stable"

    change = (recent - earliest) / earliest
    if change > TREND_CHANGE_THRESHOLD:
        return "Rising"
    if change < -TREND_CHANGE_THRESHOLD:
        return "Declining"
    return "Stable"


def build_signal_table(report_df, background_df):
    """
    report_df: one row per (report_id, reaction_term) for the selected drug
               (this is exactly what data_loader / api_client produce).
    background_df: the comparator rates table (reaction_term, comparator_event_count,
                    comparator_total_reports).

    Returns a DataFrame sorted with the most important signals first:
    reaction_term, drug_event_count (a), drug_total_reports (a+b),
    drug_event_rate, comparator_event_rate, prr, triage_label.
    """
    if report_df.empty:
        return pd.DataFrame(columns=SIGNAL_COLUMNS)

    total_drug_reports = report_df["report_id"].nunique()

    # 'a' for each reaction = number of DISTINCT reports mentioning it
    # (already deduped to one-per-report upstream, but nunique() is a safety net)
    reaction_counts = (
        report_df[report_df["reaction_term"] != "Other/unspecified"]
        .groupby("reaction_term")["report_id"]
        .nunique()
        .reset_index(name="drug_event_count")
    )

    # Build case-insensitive background lookup mapping lowercase reaction terms to rates
    bg_df = background_df.copy()
    bg_df["_clean_term"] = bg_df["reaction_term"].astype(str).str.strip().str.lower()
    background_lookup = bg_df.drop_duplicates(subset="_clean_term").set_index("_clean_term")

    rows = []
    for _, row in reaction_counts.iterrows():
        reaction = row["reaction_term"]
        reaction_clean = str(reaction).strip().lower()
        a = int(row["drug_event_count"])

        if reaction_clean in background_lookup.index:
            c = int(background_lookup.loc[reaction_clean, "comparator_event_count"])
            c_plus_d = int(background_lookup.loc[reaction_clean, "comparator_total_reports"])
        else:
            # No background data for this exact term -- can't compute a ratio.
            c, c_plus_d = 0, 0

        prr = calculate_prr(a, total_drug_reports, c, c_plus_d) if c_plus_d else None

        # The other two cells of the 2x2 table: reports without this reaction,
        # on each side of the comparison.
        b = total_drug_reports - a
        d = c_plus_d - c
        chi_square = calculate_chi_square(a, b, c, d) if c_plus_d else None

        triage = assign_triage(a, prr, chi_square)

        rows.append({
            "reaction_term": reaction,
            "drug_event_count": a,
            "drug_total_reports": total_drug_reports,
            "drug_event_rate": round(a / total_drug_reports, 4) if total_drug_reports else None,
            "comparator_event_rate": round(c / c_plus_d, 4) if c_plus_d else None,
            "prr": round(prr, 2) if prr is not None else None,
            "chi_square": chi_square,
            "triage_label": triage,
        })

    return _sorted_signal_frame(rows)


# Sort: Review priority first, then by PRR descending, missing PRR last.
TRIAGE_ORDER = {
    "Review priority": 0, "Monitor": 1, "Unstable ratio": 2,
    "Weak evidence": 3, "Limited data": 4, "Background level": 5,
    "Comparator unavailable": 6, "Insufficient data": 7,
}

SIGNAL_COLUMNS = [
    "reaction_term", "drug_event_count", "drug_total_reports",
    "drug_event_rate", "comparator_event_rate", "prr", "chi_square",
    "triage_label",
]


def _sorted_signal_frame(rows):
    """
    Shared ordering for both table builders, so the synthetic and live paths
    present results identically -- the row shape is the same either way, and
    only the source of the numbers differs.
    """
    if not rows:
        return pd.DataFrame(columns=SIGNAL_COLUMNS)

    result = pd.DataFrame(rows)
    result["_sort_key"] = result["triage_label"].map(TRIAGE_ORDER).fillna(9)
    return (
        result.sort_values(
            by=["_sort_key", "prr"], ascending=[True, False], na_position="last"
        )
        .drop(columns="_sort_key")
        .reset_index(drop=True)
    )


def build_signal_table_live(
    drug_reaction_counts, total_drug_reports, background_counts, background_total
):
    """
    The same triage table, but with every number measured rather than sampled.

    build_signal_table works from a page of raw reports against a fixed
    synthetic comparator. This one takes aggregate counts straight from
    openFDA's count endpoint: 'a' and 'a+b' are the drug's true totals across
    all of FAERS, and 'c' and 'c+d' are the real all-drug background. That
    turns the PRR denominator from an illustration into a measurement.

    A reaction missing from the background histogram gets c=0, which makes
    calculate_prr return None and lands the row on "Comparator unavailable" --
    the honest outcome, since absence from the top-N baseline is not evidence
    of a zero background rate.
    """
    rows = []

    for reaction, count in drug_reaction_counts.items():
        if reaction == "Other/unspecified":
            continue

        a = int(count)
        c = int(background_counts.get(reaction, 0))
        b = total_drug_reports - a
        d = background_total - c

        prr = calculate_prr(a, total_drug_reports, c, background_total)
        chi_square = calculate_chi_square(a, b, c, d)
        triage = assign_triage(a, prr, chi_square)

        rows.append({
            "reaction_term": reaction,
            "drug_event_count": a,
            "drug_total_reports": total_drug_reports,
            "drug_event_rate": round(a / total_drug_reports, 6) if total_drug_reports else None,
            "comparator_event_rate": round(c / background_total, 6) if background_total else None,
            "prr": round(prr, 2) if prr is not None else None,
            "chi_square": chi_square,
            "triage_label": triage,
        })

    return _sorted_signal_frame(rows)
