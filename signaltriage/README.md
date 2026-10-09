# SignalTriage

## Problem Statement
After a drug is approved, it's used by far more people, for longer, in more
varied conditions than any clinical trial covers. Rare or long-term side
effects often only surface after approval, through voluntary reports filed by
doctors, pharmacists, and patients into the FDA's public FAERS database. A
safety officer reviewing a drug sees a flat list of raw report counts per
reaction -- which is misleading on its own, since common reactions naturally
get more reports regardless of any real risk, and rare-but-important signals
can hide behind small numbers.

## Prototype Goal
Automate the comparison a safety officer would otherwise do by hand: is this
reaction reported *more than expected*, relative to a background rate, and by
how much? Turn hundreds of raw reaction counts into a short, ranked list of
what actually deserves a closer look.

## Key Features
- Drug search (3 pre-tested examples + custom search)
- Live openFDA data, with a clearly-labeled cached fallback if the API fails
- Summary cards, top-10 reactions chart, ranked signal-triage table
- "Explain this result" panel showing the full calculation behind each score
- Demographic breakdown (sex, age group, seriousness)
- Built-in methodology / limitations page

## Data Source
FDA Adverse Event Reporting System (FAERS), accessed via the free, public
openFDA API (no key required). See `data/` for the offline fallback dataset.

## Methodology
See the in-app "About the Method" section, or `metrics.py` for the exact
PRR-inspired calculation and triage-threshold logic (both are unit-tested --
run `python3 metrics.py`).

## Technology Stack
Python 3.10+, Streamlit, pandas, Plotly, requests -- entirely free, no paid
services or API keys.

## Installation
```
pip install -r requirements.txt
```

## Running the Application
```
streamlit run app.py
```

## Demo Mode
If the live API is unreachable, or the "live" toggle is off, the app
switches to a cached local dataset for the 3 supported drugs. The dashboard
always visibly discloses which mode is active.

## Limitations and Responsible Use
This tool does not diagnose, recommend treatment, prove causation, calculate
real-world incidence, or replace a validated pharmacovigilance review. FAERS
reports can be duplicated or incomplete; a report existing does not establish
that a drug caused the event. The comparator/background dataset here is a
fixed, documented sample for demonstration purposes, not a statistically
rigorous production comparator.

## AI-Assisted Development
AI-assisted development was used as a pair-programming workflow: generating
the initial Streamlit layout, drafting API request/parsing functions,
identifying edge cases (missing fields, zero denominators, API failures), and
refining error messages. All calculations were verified against known test
values, and the methodology, thresholds, and safety-language guardrails were
deliberate human decisions.

## Future Enhancements
Formal case-version deduplication, primary-suspect-drug filtering, a more
rigorous statistical comparator, confidence intervals, MedDRA hierarchy
analysis, an analyst review/annotation workflow, and audit trails for
regulated use.
