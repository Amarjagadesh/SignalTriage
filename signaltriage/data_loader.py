"""
Handles the "live API vs. cached demo data" decision, and loading the
background/comparator rates used in every PRR calculation.
"""
from pathlib import Path
import pandas as pd

try:
    from api_client import fetch_openfda_reports, normalize_records
except ImportError:
    from signaltriage.api_client import fetch_openfda_reports, normalize_records

DATA_DIR = Path(__file__).parent / "data"

SUPPORTED_DRUGS = ["metformin", "ibuprofen", "atorvastatin"]


def load_cached_demo_data(drug_name):
    """Loads the pre-built fallback CSV for a supported drug."""
    path = DATA_DIR / f"{drug_name.lower()}_demo.csv"
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def load_background_rates():
    """Loads the comparator/background reaction rates (used by all drugs)."""
    path = DATA_DIR / "reaction_background_rates.csv"
    return pd.read_csv(path)


def get_drug_report_data(drug_name, use_live_api, limit=100):
    """
    Returns (dataframe, data_mode_string).

    Tries the live API first if requested. Falls back to cached demo
    data if the live call fails OR if the drug isn't one of the three
    pre-tested examples with real cached data available.
    """
    drug_name_clean = drug_name.strip().lower()

    if use_live_api:
        raw_records = fetch_openfda_reports(drug_name_clean, limit=limit)
        if raw_records:  # not None and not empty
            rows = normalize_records(raw_records, drug_name_clean)
            if rows:
                return pd.DataFrame(rows), "Live API"

    # Fall back to cached demo data (only available for the 3 supported drugs)
    if drug_name_clean in SUPPORTED_DRUGS:
        df = load_cached_demo_data(drug_name_clean)
        if not df.empty:
            return df, "Cached demo data"

    return pd.DataFrame(), "No data available"
