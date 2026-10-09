"""
SignalTriage -- An Exploratory Pharmacovigilance Analytics Prototype

Run with: streamlit run app.py
"""
import datetime
import pandas as pd
import plotly.express as px
import streamlit as st

try:
    from data_loader import get_drug_report_data, load_background_rates, SUPPORTED_DRUGS
    from analytics import build_signal_table
except ImportError:
    from signaltriage.data_loader import get_drug_report_data, load_background_rates, SUPPORTED_DRUGS
    from signaltriage.analytics import build_signal_table

st.set_page_config(page_title="SignalTriage", layout="wide")

TRIAGE_COLORS = {
    "Review priority": "#d62728",
    "Monitor": "#ff7f0e",
    "Unstable ratio": "#9467bd",
    "Limited data": "#9467bd",
    "Background level": "#2ca02c",
    "Comparator unavailable": "#7f7f7f",
    "Insufficient data": "#7f7f7f",
}

# ---------- Sidebar ----------
st.sidebar.title("PV SignalTriage")
st.sidebar.caption("Exploratory Pharmacovigilance Analytics Prototype")

drug_choice = st.sidebar.selectbox(
    "Choose a pre-tested medicine",
    options=["metformin", "ibuprofen", "atorvastatin"],
    format_func=lambda x: x.title(),
)
custom_drug = st.sidebar.text_input("...or search a custom generic drug name")
selected_drug = custom_drug.strip() if custom_drug.strip() else drug_choice

use_live = st.sidebar.toggle("Try live openFDA API first", value=True)
report_limit = st.sidebar.slider("Max reports to retrieve (live mode)", 50, 500, 100, step=50)

st.sidebar.divider()
st.sidebar.caption(
    "Built as an AI-assisted development prototype. Not for clinical, "
    "regulatory, or medical decision-making."
)

analyze = st.sidebar.button("Analyze", type="primary", use_container_width=True)

# ---------- Header ----------
st.title("PV SignalTriage")
st.caption(
    "An exploratory dashboard for prioritizing reported drug-event patterns "
    "for human pharmacovigilance review."
)
st.warning(
    "**Not clinical advice. Not a causality assessment.** This prototype is "
    "for exploratory analysis of spontaneous adverse-event reports only. "
    "A report existing does not mean the drug caused the event."
)

if not analyze and "last_drug" not in st.session_state:
    st.info("Choose a pre-tested medicine in the sidebar (or enter a custom "
            "one) and click **Analyze** to begin.")
    st.stop()

if analyze:
    st.session_state["last_drug"] = selected_drug
    st.session_state["last_use_live"] = use_live
    st.session_state["last_limit"] = report_limit

drug = st.session_state.get("last_drug", selected_drug)
live_flag = st.session_state.get("last_use_live", use_live)
limit = st.session_state.get("last_limit", report_limit)

# ---------- Fetch + analyze ----------
with st.spinner(f"Retrieving adverse-event data for {drug}..."):
    report_df, data_mode = get_drug_report_data(drug, live_flag, limit=limit)
    background_df = load_background_rates()

if report_df.empty:
    st.error(
        f"No matching records were retrieved for **{drug}**. Try a generic "
        f"drug name, choose a sample medicine ({', '.join(SUPPORTED_DRUGS)}), "
        f"or switch off live mode to use demo data."
    )
    st.stop()

signal_table = build_signal_table(report_df, background_df)

# ---------- Data mode banner ----------
mode_col1, mode_col2 = st.columns([3, 1])
with mode_col1:
    if data_mode == "Live API":
        st.success(f"Analysis completed using **Live openFDA data**. "
                    f"Retrieved at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}.")
    else:
        st.info(f"Live data could not be retrieved (or live mode is off). "
                f"Showing clearly labeled **{data_mode}** so the workflow "
                f"can still be explored.")
with mode_col2:
    st.metric("Data source", "FAERS / openFDA")

# ---------- Summary cards ----------
total_reports = report_df["report_id"].nunique()
distinct_reactions = signal_table["reaction_term"].nunique()
top_reaction = (
    signal_table.sort_values("drug_event_count", ascending=False).iloc[0]["reaction_term"]
    if not signal_table.empty else "N/A"
)
review_priority_count = (signal_table["triage_label"] == "Review priority").sum()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Drug analyzed", drug.title())
c2.metric("Reports analyzed", f"{total_reports:,}")
c3.metric("Distinct reactions", distinct_reactions)
c4.metric("Review-priority events", int(review_priority_count))

st.divider()

# ---------- Top reactions chart ----------
st.subheader(f"Top reported reactions for {drug.title()}")
top10 = signal_table.sort_values("drug_event_count", ascending=False).head(10)
fig = px.bar(
    top10.sort_values("drug_event_count"),
    x="drug_event_count", y="reaction_term", orientation="h",
    labels={"drug_event_count": "Number of reports", "reaction_term": ""},
)
st.plotly_chart(fig, use_container_width=True)

st.divider()

# ---------- Signal-triage table ----------
st.subheader("Exploratory signal-triage table")
st.caption(
    "Ranked using a PRR-inspired reporting ratio -- not a validated "
    "regulatory signal-detection result. See 'About the Method' below."
)

filter_choice = st.radio(
    "Filter", ["All", "Review priority", "Monitor", "Insufficient data"],
    horizontal=True,
)
display_table = signal_table.copy()
if filter_choice != "All":
    display_table = display_table[display_table["triage_label"] == filter_choice]

st.dataframe(
    display_table.rename(columns={
        "reaction_term": "Reaction", "drug_event_count": "Drug reports (a)",
        "drug_total_reports": "Drug total (a+b)", "drug_event_rate": "Drug rate",
        "comparator_event_rate": "Background rate", "prr": "PRR-inspired ratio",
        "triage_label": "Triage status",
    }),
    use_container_width=True, hide_index=True,
)

csv_bytes = display_table.to_csv(index=False).encode("utf-8")
st.download_button("Download table as CSV", csv_bytes, file_name=f"{drug}_signal_triage.csv")

st.divider()

# ---------- Explain this result ----------
st.subheader("Explain this result")
reaction_options = signal_table["reaction_term"].tolist()
if reaction_options:
    selected_reaction = st.selectbox("Select a reaction to see the calculation", reaction_options)
    row = signal_table[signal_table["reaction_term"] == selected_reaction].iloc[0]

    a = row["drug_event_count"]
    n = row["drug_total_reports"]
    drug_rate = row["drug_event_rate"]
    bg_rate = row["comparator_event_rate"]
    prr = row["prr"]

    if prr is not None:
        explanation = (
            f"**{selected_reaction}** appeared in **{a} of {n}** retrieved reports "
            f"associated with **{drug.title()}** ({drug_rate:.1%}). In the defined "
            f"comparator dataset, the event was reported at **{bg_rate:.1%}**. "
            f"The PRR-inspired reporting ratio is **{prr:.2f}**.\n\n"
            f"This indicates disproportionate reporting within this exploratory "
            f"dataset -- it does **not** prove causality or clinical risk."
        )
    else:
        explanation = (
            f"**{selected_reaction}** appeared in {a} of {n} retrieved reports, "
            f"but no reliable comparator rate is available for this term, so a "
            f"ratio cannot be shown as a meaningful signal."
        )
    st.markdown(explanation)
    st.caption(f"Triage status: **{row['triage_label']}**")

st.divider()

# ---------- Demographics ----------
st.subheader("Demographic summary")
st.caption("Demographics in retrieved reports; missing values excluded.")

demo_df = report_df.drop_duplicates(subset="report_id")
d1, d2, d3 = st.columns(3)

with d1:
    sex_counts = demo_df["sex"].value_counts().reset_index()
    sex_counts.columns = ["sex", "count"]
    st.plotly_chart(px.pie(sex_counts, names="sex", values="count", title="Reported sex", hole=0.4),
                     use_container_width=True)

with d2:
    age_counts = demo_df["age_group"].value_counts().reset_index()
    age_counts.columns = ["age_group", "count"]
    st.plotly_chart(px.bar(age_counts, x="age_group", y="count", title="Age group"),
                     use_container_width=True)

with d3:
    serious_counts = demo_df["serious"].value_counts().reset_index()
    serious_counts.columns = ["serious", "count"]
    st.plotly_chart(px.pie(serious_counts, names="serious", values="count", title="Serious vs. non-serious"),
                     use_container_width=True)

st.divider()

# ---------- Methodology ----------
with st.expander("About the Method"):
    st.markdown(f"""
**What is FAERS?** The FDA Adverse Event Reporting System -- a public database of
voluntary reports from doctors, pharmacists, and patients who suspect a drug caused
a reaction. A report is not proof of causation.

**What does this app calculate?** For each reported reaction, a PRR-inspired
reporting ratio comparing the reaction's rate within the selected drug's reports
against its rate in a defined comparator dataset:

PRR = [a / (a+b)] / [c / (c+d)]

- a = drug reports with this reaction, b = drug reports without it
- c = comparator reports with this reaction, d = comparator reports without it

**Triage thresholds used here** (prototype thresholds for transparent exploratory
prioritization, not regulatory thresholds):
- Fewer than 3 reports -> Insufficient data
- PRR < 1 -> Background level
- PRR 1-2 -> Monitor
- PRR >= 2 with at least 5 reports -> Review priority
- PRR >= 2 with fewer than 5 reports -> Unstable ratio

**Limitations:** Spontaneous reports can be duplicated, incomplete, and subject to
reporting bias. This tool does not establish causation, incidence, or patient-level
risk, and does not replace a validated pharmacovigilance workflow.

**Data source:** FDA FAERS, accessed via the public openFDA API. Current data
mode: **{data_mode}**.
""")
