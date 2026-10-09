"""
The actual analytical core of SignalTriage: two small functions.
Everything else in the app (UI, charts, API calls) exists to feed data
into these functions and display what comes out.
"""


def calculate_prr(a, a_plus_b, c, c_plus_d):
    """
    a         = reports with the drug AND the reaction
    a_plus_b  = total reports for the drug (a + b)
    c         = comparator reports WITH the reaction
    c_plus_d  = total comparator reports (c + d)

    Returns the PRR-inspired ratio, or None if it can't be computed
    (e.g. the reaction never appears in the comparator set at all --
    we never want to silently show "infinity" as if it were a real number).
    """
    if a_plus_b == 0 or c_plus_d == 0:
        return None

    drug_rate = a / a_plus_b
    background_rate = c / c_plus_d

    if background_rate == 0:
        return None

    return drug_rate / background_rate


def assign_triage(event_count, prr, chi_square=None):
    """
    Turns (event_count, prr, chi_square) into one triage label.
    event_count is 'a' -- how many reports of the DRUG also mention this
    specific reaction.

    A raised ratio is now necessary but no longer sufficient to reach
    "Review priority": it must also clear chi-square >= 4 (roughly p < 0.05
    for one degree of freedom) and rest on at least 5 reports. Anything that
    looks elevated but fails the statistical test lands in "Weak evidence"
    instead, which is the honest description of a ratio that could be noise.

    chi_square is optional so existing callers keep working; when it is not
    supplied, a raised ratio can rise no higher than "Weak evidence", because
    without the test there is nothing to justify a stronger claim.
    """
    if event_count < 3:
        return "Insufficient data"
    if prr is None:
        return "Comparator unavailable"
    if prr < 1:
        return "Background level"
    if prr < 2:
        return "Monitor"
    if chi_square is None or chi_square < 4:
        return "Weak evidence"
    if event_count < 5:
        return "Unstable ratio"
    return "Review priority"


def calculate_chi_square(a, b, c, d):
    """
    Chi-square with Yates' continuity correction for the 2x2 table:

                    reaction    no reaction
        drug            a            b
        comparator      c            d

    PRR alone says how much more often a reaction was reported; it says
    nothing about whether that difference could be chance. A PRR of 3.0
    built on four reports and a PRR of 3.0 built on four hundred look
    identical in the table. Chi-square is what separates them, which is why
    the triage ladder now consults it before promoting anything to review.

    Returns the statistic rounded to 2 decimals, or None when it cannot be
    computed. Never raises -- callers treat None as "no evidence either way".
    """
    try:
        n = a + b + c + d
        denominator = (a + b) * (c + d) * (a + c) * (b + d)
        if denominator == 0:
            return None

        # Yates' correction subtracts N/2 to compensate for using a continuous
        # distribution on discrete counts. When |ad - bc| is smaller than N/2
        # the correction overshoots; squaring keeps the result positive and
        # negligibly small, which is the right answer anyway (no association).
        chi2 = n * (abs(a * d - b * c) - n / 2) ** 2 / denominator
        return round(chi2, 2)
    except (TypeError, ZeroDivisionError):
        return None


if __name__ == "__main__":
    # Exact unit tests from the project plan -- run this file directly
    # (`py metrics.py`) any time you touch this logic.
    tests = [
        # (a, a+b, c, c+d, expected_prr, expected_triage)
        # CHANGED: was "Review priority". assign_triage is called here without a
        # chi_square, and an unsupported ratio can no longer be promoted past
        # "Weak evidence". The chi-square-aware version of this same table is
        # asserted in the ladder tests below, where it does reach Review priority.
        (50, 1000, 500, 100_000, 10.0, "Weak evidence"),
        (10, 100, 100, 1000, 1.0, "Monitor"),  # PRR==1 is not <1, so "Monitor" not "Background level"
        (5, 1000, 0, 10_000, None, "Comparator unavailable"),
    ]

    print("Running metrics.py self-tests...\n")
    all_passed = True
    for a, ab, c, cd, expected_prr, expected_triage in tests:
        prr = calculate_prr(a, ab, c, cd)
        triage = assign_triage(a, prr)

        prr_ok = (prr == expected_prr) or (
            prr is not None and expected_prr is not None and abs(prr - expected_prr) < 1e-9
        )
        triage_ok = triage == expected_triage

        status = "PASS" if (prr_ok and triage_ok) else "FAIL"
        if status == "FAIL":
            all_passed = False
        print(f"[{status}] a={a}, a+b={ab}, c={c}, c+d={cd} "
              f"-> prr={prr} (expected {expected_prr}), "
              f"triage='{triage}' (expected '{expected_triage}')")

    # --- Chi-square tests (added alongside the PRR tests above) ---
    # Expectations are bounds rather than exact values: the point of each case
    # is which side of the significance threshold (4) it lands on.
    chi_tests = [
        # (a, b, c, d, description, predicate)
        (50, 950, 500, 99_500,
         "strong association -> well above 4",
         lambda x: x is not None and x > 4),
        (10, 90, 100, 900,
         "no association (ad == bc) -> approximately 0",
         lambda x: x is not None and x < 0.5),
        (0, 0, 0, 0,
         "empty table -> None rather than a crash",
         lambda x: x is None),
    ]

    print("\nRunning chi-square self-tests...\n")
    for a, b, c, d, description, predicate in chi_tests:
        chi2 = calculate_chi_square(a, b, c, d)
        status = "PASS" if predicate(chi2) else "FAIL"
        if status == "FAIL":
            all_passed = False
        print(f"[{status}] a={a}, b={b}, c={c}, d={d} -> chi2={chi2} ({description})")

    # --- Triage ladder tests: every rung, including the chi-square gate ---
    ladder_tests = [
        # (event_count, prr, chi_square, expected_label)
        (2, 10.0, 500, "Insufficient data"),      # count gate comes first
        (10, None, None, "Comparator unavailable"),
        (10, 0.5, 500, "Background level"),
        (10, 1.5, 500, "Monitor"),
        (10, 3.0, None, "Weak evidence"),         # raised ratio, untested
        (10, 3.0, 2.1, "Weak evidence"),          # raised ratio, fails the test
        (4, 3.0, 12.0, "Unstable ratio"),         # passes the test, too few reports
        (50, 10.0, 361.94, "Review priority"),    # the full-strength case
    ]

    print("\nRunning triage ladder self-tests...\n")
    for count, prr_value, chi_value, expected in ladder_tests:
        label = assign_triage(count, prr_value, chi_value)
        status = "PASS" if label == expected else "FAIL"
        if status == "FAIL":
            all_passed = False
        print(f"[{status}] count={count}, prr={prr_value}, chi2={chi_value} "
              f"-> '{label}' (expected '{expected}')")

    print("\nAll tests passed!" if all_passed else "\nSome tests FAILED -- check the logic above.")
