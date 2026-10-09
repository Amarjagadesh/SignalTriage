"""
Generates local fallback data so the app works even if the live openFDA
API is unreachable during the demo.

The reaction counts below aren't random — they're set to reflect real,
well-documented safety associations (e.g. metformin + lactic acidosis,
ibuprofen + GI bleeding, atorvastatin + rhabdomyolysis), so the PRR
numbers this data produces are medically plausible, not just illustrative.
"""
import csv
import random
from pathlib import Path

random.seed(42)
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# reaction_term -> count of reports (out of the drug's total report pool)
DRUGS = {
    "metformin": {
        "total_reports": 1000,
        "reactions": {
            "Nausea": 180, "Diarrhoea": 150, "Abdominal discomfort": 90,
            "Headache": 60, "Dizziness": 40, "Fatigue": 70,
            "Vitamin B12 deficiency": 12, "Lactic acidosis": 8,
            "Metallic taste": 3, "Angioedema": 2,
        },
    },
    "ibuprofen": {
        "total_reports": 1000,
        "reactions": {
            "Nausea": 140, "Abdominal pain": 130, "Dyspepsia": 90,
            "Headache": 55, "Dizziness": 35, "Rash": 45,
            "Gastrointestinal haemorrhage": 25, "Renal impairment": 10,
            "Stevens-Johnson syndrome": 4,
        },
    },
    "atorvastatin": {
        "total_reports": 1000,
        "reactions": {
            "Myalgia": 160, "Arthralgia": 70, "Headache": 55, "Nausea": 60,
            "Fatigue": 45, "Hepatic enzyme increased": 20,
            "Diabetes mellitus": 15, "Rhabdomyolysis": 5,
        },
    },
}

# Background/comparator rates: reaction_term -> (count, total_comparator_reports)
# Comparator pool = 100,000 reports "across other drugs" (documented, fixed).
COMPARATOR_TOTAL = 100_000
BACKGROUND = {
    "Nausea": 8000, "Diarrhoea": 6000, "Abdominal discomfort": 3000,
    "Headache": 9000, "Dizziness": 5000, "Fatigue": 5000,
    "Vitamin B12 deficiency": 100, "Lactic acidosis": 40,
    "Metallic taste": 100, "Angioedema": 50, "Abdominal pain": 3000,
    "Dyspepsia": 4000, "Rash": 2000, "Gastrointestinal haemorrhage": 300,
    "Renal impairment": 200, "Stevens-Johnson syndrome": 20,
    "Myalgia": 2500, "Arthralgia": 2000, "Hepatic enzyme increased": 150,
    "Diabetes mellitus": 800, "Rhabdomyolysis": 30,
}

AGE_BANDS = [(18, 30), (31, 45), (46, 60), (61, 75), (76, 90)]
SEXES = ["Male", "Female", "Unknown"]
YEARS = [2022, 2023, 2024, 2025, 2026]


def age_group(age):
    for lo, hi in AGE_BANDS:
        if lo <= age <= hi:
            return f"{lo}-{hi}"
    return "Unknown"


def make_drug_csv(drug_name, spec):
    rows = []
    report_id = 1
    reaction_pool = list(spec["reactions"].items())

    # One row per (report_id, reaction) pair for reports that had a listed reaction
    for reaction, count in reaction_pool:
        for _ in range(count):
            age = random.randint(18, 90)
            rows.append({
                "report_id": f"{drug_name.upper()}-{report_id:05d}",
                "drug_name": drug_name,
                "reaction_term": reaction,
                "serious": random.choice(["Yes", "Yes", "No"]),
                "sex": random.choice(SEXES),
                "age": age,
                "age_group": age_group(age),
                "report_year": random.choice(YEARS),
                "source_mode": "cached_demo",
            })
            report_id += 1

    # Pad remaining reports up to total_reports with "Other/unspecified" so
    # summary cards (total report count) reflect the documented total.
    reactions_assigned = sum(spec["reactions"].values())
    remaining = spec["total_reports"] - reactions_assigned
    for _ in range(max(remaining, 0)):
        age = random.randint(18, 90)
        rows.append({
            "report_id": f"{drug_name.upper()}-{report_id:05d}",
            "drug_name": drug_name,
            "reaction_term": "Other/unspecified",
            "serious": random.choice(["Yes", "No", "No"]),
            "sex": random.choice(SEXES),
            "age": age,
            "age_group": age_group(age),
            "report_year": random.choice(YEARS),
            "source_mode": "cached_demo",
        })
        report_id += 1

    path = DATA_DIR / f"{drug_name}_demo.csv"
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows -> {path}")


def make_background_csv():
    path = DATA_DIR / "reaction_background_rates.csv"
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "reaction_term", "comparator_event_count",
            "comparator_total_reports", "background_rate",
            "dataset_definition", "last_refreshed",
        ])
        writer.writeheader()
        for reaction, count in BACKGROUND.items():
            writer.writerow({
                "reaction_term": reaction,
                "comparator_event_count": count,
                "comparator_total_reports": COMPARATOR_TOTAL,
                "background_rate": round(count / COMPARATOR_TOTAL, 6),
                "dataset_definition": "Fixed cached comparator sample of "
                                       "100,000 reports across other drugs, "
                                       "for offline/demo mode only.",
                "last_refreshed": "2026-08-29",
            })
    print(f"Wrote background rates -> {path}")


if __name__ == "__main__":
    for drug, spec in DRUGS.items():
        make_drug_csv(drug, spec)
    make_background_csv()
