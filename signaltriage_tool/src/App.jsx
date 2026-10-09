import { useCallback, useState } from 'react'
import './App.css'
import { useAnalysis } from './hooks/useAnalysis'
import { SiteNav } from './components/SiteNav'
import { PharmaHero } from './hero/PharmaHero'
import { DrugSearch } from './components/DrugSearch'
import { SummaryCards } from './components/SummaryCards'
import { BriefingPanel } from './components/BriefingPanel'
import { AnalysisBackdrop } from './components/AnalysisBackdrop'
import { BaselineTrace } from './components/BaselineTrace'
import { SignalTable } from './components/SignalTable'
import { ExplainPanel } from './components/ExplainPanel'
import { DemographicsPanel } from './components/DemographicsPanel'

/*
 * Reports the backend's data_mode verbatim rather than collapsing it to
 * live-or-cached. There are three real states now and they differ in what
 * actually matters -- whether the PRR denominator is measured or synthetic --
 * so flattening them would hide the one thing a reader needs to judge the
 * numbers by.
 */
const DATA_MODES = {
  'Live API (real comparator)': {
    variant: 'live',
    badge: '● Live openFDA API — real comparator',
    detail: 'Background rates fetched live from all-drug FAERS frequencies at analysis time.',
  },
  'Live API (cached comparator)': {
    variant: 'cached',
    badge: '◐ Live reports — cached comparator',
    detail: 'Reports are live, but the live background could not be reached, so ratios use the fixed offline sample.',
  },
  'Cached demo data': {
    variant: 'cached',
    badge: '◖ Cached demo data',
    detail: 'Offline benchmark cache, for exploring the workflow without a live connection.',
  },
}

function DataModeBanner({ data }) {
  const mode = DATA_MODES[data.data_mode] ?? {
    variant: 'cached',
    badge: data.data_mode,
    detail: '',
  }

  return (
    <div className={`data-mode-banner data-mode-banner--${mode.variant}`}>
      <div className="data-mode-banner__content">
        <span className="data-mode-banner__badge">{mode.badge}</span>
        <span className="data-mode-banner__message">
          {mode.detail} Analysing <strong>{data.drug}</strong>.
        </span>
        {data.notes?.length > 0 && (
          <ul className="data-mode-banner__notes">
            {data.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

function App() {
  const { data, loading, error, runAnalysis } = useAnalysis()
  // Lives here (the parent) specifically so the table and the explain
  // panel below it can share the same "currently selected reaction" --
  // clicking a table row updates the explanation panel automatically.
  const [selectedReaction, setSelectedReaction] = useState(null)

  const handleAnalyze = (drug, options) => {
    setSelectedReaction(null)
    runAnalysis(drug, options)
  }

  const scrollTo = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <>
      <SiteNav onNavigate={scrollTo} />

      <PharmaHero onExplore={() => scrollTo('analysis')} />

      <main className="app-shell" id="analysis">
        <AnalysisBackdrop />

        <header className="section-head">
          <p className="section-head__eyebrow mono">01 &mdash; Disproportionality analysis</p>
          <h2 className="section-head__title">
            Search a drug, rank its reported reactions
          </h2>
          <p className="section-head__lede">
            Live openFDA FAERS data where available, with a clearly labelled offline
            benchmark cache as fallback.
          </p>
        </header>

        <div className="disclaimer-card">
          <div className="disclaimer-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div className="disclaimer-card__text">
            <strong>Exploratory Research Tool &mdash; Not Clinical Advice:</strong> Spontaneous reporting metrics quantify statistical disproportionality within FAERS cohorts, not medical causation, incidence, or individual patient risk.
          </div>
        </div>

        <DrugSearch onAnalyze={handleAnalyze} loading={loading} />

        {error && (
          <div className="summary-card" style={{ borderLeft: '3px solid var(--color-review)', marginBottom: 'var(--space-lg)' }}>
            {error}
          </div>
        )}

        {data && (
          <>
            <DataModeBanner data={data} />

            <SummaryCards data={data} />
            <BriefingPanel briefing={data.briefing} source={data.briefing_source} />
            <BaselineTrace signalTable={data.signal_table} />
            <SignalTable
              signalTable={data.signal_table}
              drugName={data.drug}
              selectedReaction={selectedReaction}
              onSelectReaction={setSelectedReaction}
            />
            <DemographicsPanel demographics={data.demographics} />
            <ExplainPanel
              signalTable={data.signal_table}
              drugName={data.drug}
              selectedReaction={selectedReaction}
              onSelectReaction={setSelectedReaction}
              trends={data.trends}
            />
          </>
        )}

        {/* Hoisted out of the results block: the methodology should be
            readable before anyone runs an analysis, not only after. */}
        <details className="methodology-card" id="method">
          <summary className="methodology-card__summary">About the Method &amp; Limitations</summary>
          <div className="methodology-card__content">
            <h3>What is FAERS?</h3>
            <p>
              The FDA Adverse Event Reporting System (FAERS) is a database containing spontaneous reports of adverse events and medication errors submitted by healthcare professionals, consumers, and manufacturers. A report in FAERS does not establish that the drug caused the event.
            </p>

            <h3>How is the PRR-inspired ratio calculated?</h3>
            <p>
              For each reported reaction term, the rate of that reaction within the selected drug&apos;s reports is compared against its background rate in the comparator dataset:
            </p>
            <div className="methodology-card__formula mono">
              PRR = [a / (a + b)] / [c / (c + d)]
            </div>
            <ul>
              <li><strong>a</strong> = Reports mentioning both the drug and reaction</li>
              <li><strong>a + b</strong> = Total reports for the drug</li>
              <li><strong>c</strong> = Comparator reports mentioning the reaction</li>
              <li>
                <strong>c + d</strong> = Total comparator reports &mdash; the live count of all
                FAERS reports across all drugs at analysis time (simplified all-drug baseline;
                a rigorous PRR would exclude the index drug and de-duplicate report versions).
              </li>
            </ul>

            <h3>Where the numbers come from</h3>
            <p>
              In live mode both sides of the ratio are measured, not sampled.{" "}
              <strong>a</strong> and <strong>a + b</strong> come from openFDA&apos;s count
              endpoint for the selected drug, and <strong>c</strong> and <strong>c + d</strong>{" "}
              from the same endpoint with no drug filter &mdash; the whole FAERS corpus. The
              banner above each analysis states which comparator was actually used.
            </p>
            <p>
              Two limits are worth knowing. The count endpoint returns the 500 most frequent
              reaction terms per query without an API key, so a reaction outside that list has
              no background rate and is reported as &ldquo;Comparator unavailable&rdquo; rather
              than assumed to be zero. And the demographic and year-trend panels still read
              individual reports, so they describe a sample of the corpus while the ratios
              describe all of it.
            </p>

            <h3>Prototype Triage Thresholds</h3>
            <ul>
              <li><strong>Fewer than 3 reports (a &lt; 3):</strong> Insufficient data</li>
              <li><strong>PRR &lt; 1.0:</strong> Background level</li>
              <li><strong>PRR between 1.0 and 2.0:</strong> Monitor</li>
              <li><strong>PRR &ge; 2.0 with at least 5 reports:</strong> Review priority</li>
              <li><strong>PRR &ge; 2.0 with 3&ndash;4 reports:</strong> Unstable ratio</li>
              <li><strong>Missing comparator rate:</strong> Comparator unavailable</li>
            </ul>

            <h3>Important Limitations</h3>
            <p>
              Spontaneous reports are subject to under-reporting, duplicate submissions, and confounding by indication. This prototype is for exploratory prioritization only and does not establish clinical causality, drug safety approval status, or real-world incidence rates.
            </p>
          </div>
        </details>
      </main>
    </>
  )
}

export default App
