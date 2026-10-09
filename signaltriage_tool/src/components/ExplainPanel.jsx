/*
 * Reads one row of the signal table back in plain language.
 *
 * Three things now sit under the PRR sentence: what the ratio means, how much
 * confidence the statistics actually support, and whether reporting has been
 * moving over time. The confidence line matters most -- a ratio on its own
 * invites more certainty than the underlying counts justify.
 */

const CHI_SQUARE_THRESHOLD = 4; // ~p < 0.05 at one degree of freedom
const MIN_STABLE_REPORTS = 5;

/*
 * Deliberately ordered, not a lookup: the checks overlap, and the first one
 * that matches is the most important thing to say about the row.
 *
 * Both "Elevated..." branches are gated on the ratio actually being elevated.
 * Without that gate they fire on any row with few reports or a low
 * chi-square, which produced statements like "Elevated ratio, weak
 * statistical support" for Dizziness at a PRR of 0.80 -- a rate *below*
 * background. Describing an under-reported event as elevated is the kind of
 * error this panel exists to prevent.
 */
function describeConfidence(row) {
  const { prr, chi_square: chiSquare, drug_event_count: count } = row;
  const isElevated = prr !== null && prr !== undefined && prr >= 2;
  const hasChiSquare = chiSquare !== null && chiSquare !== undefined;

  if (isElevated && hasChiSquare && chiSquare >= CHI_SQUARE_THRESHOLD && count >= MIN_STABLE_REPORTS) {
    return { tone: "strong", text: "Strong, statistically supported signal" };
  }
  if (isElevated && count < MIN_STABLE_REPORTS) {
    return { tone: "caution", text: "Elevated but based on few reports — treat with caution" };
  }
  if (isElevated && hasChiSquare && chiSquare < CHI_SQUARE_THRESHOLD) {
    return { tone: "weak", text: "Elevated ratio, weak statistical support" };
  }
  if (count < MIN_STABLE_REPORTS) {
    return { tone: "caution", text: "Too few reports to judge" };
  }
  return { tone: "neutral", text: "Within expected background range" };
}

function TrendBars({ trend }) {
  if (!trend || !trend.years?.length) {
    return (
      <p className="trend__empty">
        Not enough dated reports to show a year-by-year trend.
      </p>
    );
  }

  // Bars are scaled to the largest year in this reaction's own history, so the
  // shape of its trend is readable even when the absolute rate is tiny.
  const peak = Math.max(...trend.rates, 0.0001);

  return (
    <>
      <div className="trend__bars">
        {trend.years.map((year, index) => {
          const rate = trend.rates[index];
          const height = Math.max((rate / peak) * 100, 2);
          return (
            <div className="trend__col" key={year}>
              <div className="trend__track">
                <div
                  className="trend__fill"
                  style={{ height: `${height}%` }}
                  title={`${year}: ${trend.counts[index]} of ${trend.totals[index]} reports (${(rate * 100).toFixed(2)}%)`}
                />
              </div>
              <span className="trend__year mono">{year}</span>
            </div>
          );
        })}
      </div>
      {trend.thin_years?.length > 0 && (
        <p className="trend__note">
          {trend.thin_years.join(", ")} excluded — fewer than 10 reports that year.
        </p>
      )}
    </>
  );
}

export function ExplainPanel({
  signalTable,
  drugName,
  selectedReaction,
  onSelectReaction,
  trends = {},
}) {
  const row = signalTable.find((r) => r.reaction_term === selectedReaction) || signalTable[0];
  if (!row) return null;

  const drugLabel = drugName.charAt(0).toUpperCase() + drugName.slice(1);
  const confidence = describeConfidence(row);
  const trend = trends?.[row.reaction_term];
  const direction = trend?.direction ?? "Insufficient history";

  return (
    <div className="explain-panel">
      <h2>Explain this result</h2>

      <select
        className="explain-panel__select"
        value={row.reaction_term}
        onChange={(e) => onSelectReaction(e.target.value)}
      >
        {signalTable.map((r) => (
          <option key={r.reaction_term} value={r.reaction_term}>{r.reaction_term}</option>
        ))}
      </select>

      {row.prr !== null ? (
        <p className="explain-panel__text">
          <strong>{row.reaction_term}</strong> appeared in{" "}
          <span className="mono">{row.drug_event_count} of {row.drug_total_reports}</span>{" "}
          retrieved reports associated with <strong>{drugLabel}</strong>{" "}
          (<span className="mono">{(row.drug_event_rate * 100).toFixed(1)}%</span>). In the defined
          comparator dataset, the event was reported at{" "}
          <span className="mono">{(row.comparator_event_rate * 100).toFixed(1)}%</span>.
          The PRR-inspired reporting ratio is <span className="mono">{row.prr}</span>
          {row.chi_square !== null && row.chi_square !== undefined && (
            <>, with a chi-square of <span className="mono">{row.chi_square}</span></>
          )}.
          <br /><br />
          This indicates disproportionate reporting within this exploratory dataset &mdash;
          it does <strong>not</strong> prove causality or clinical risk.
        </p>
      ) : (
        <p className="explain-panel__text">
          <strong>{row.reaction_term}</strong> appeared in {row.drug_event_count} of{" "}
          {row.drug_total_reports} retrieved reports, but no reliable comparator rate is
          available for this term, so a ratio cannot be shown as a meaningful signal.
        </p>
      )}

      <div className={`confidence confidence--${confidence.tone}`}>
        <span className="confidence__label mono">Confidence</span>
        <span className="confidence__text">{confidence.text}</span>
      </div>

      <div className="trend">
        <div className="trend__head">
          <h3 className="trend__title">Reporting rate by year</h3>
          <span
            className={`trend__badge trend__badge--${direction.split(" ")[0].toLowerCase()}`}
          >
            {direction}
          </span>
        </div>
        <TrendBars trend={trend} />
      </div>

      <p className="explain-panel__status">Triage status: <strong>{row.triage_label}</strong></p>
    </div>
  );
}
