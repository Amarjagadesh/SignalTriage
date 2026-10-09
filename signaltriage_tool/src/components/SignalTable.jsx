import { useState } from "react";
import { triageColor } from "../utils/triageColors";

const FILTERS = [
  "All",
  "Review priority",
  "Monitor",
  "Unstable ratio",
  "Weak evidence",
  "Background level",
  "Comparator unavailable",
  "Insufficient data",
];

function formatCsvField(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows) {
  const headers = [
    { key: "reaction_term", label: "Reaction" },
    { key: "drug_event_count", label: "Drug reports (a)" },
    { key: "drug_total_reports", label: "Drug total (a+b)" },
    { key: "drug_event_rate", label: "Drug rate" },
    { key: "comparator_event_rate", label: "Background rate" },
    { key: "prr", label: "PRR-inspired ratio" },
    { key: "chi_square", label: "Chi-square" },
    { key: "triage_label", label: "Triage status" },
  ];
  const lines = [headers.map((h) => formatCsvField(h.label)).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => formatCsvField(row[h.key])).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(rows, drugName) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${drugName}_signal_triage.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SignalTable({ signalTable, drugName, selectedReaction, onSelectReaction }) {
  const [filter, setFilter] = useState("All");

  const rows = filter === "All"
    ? signalTable
    : signalTable.filter((r) => r.triage_label === filter);

  return (
    <div className="signal-table-card">
      <div className="signal-table-card__header">
        <div>
          <h2>Exploratory signal-triage table</h2>
          <p className="signal-table-card__caption">
            Ranked using a PRR-inspired reporting ratio &mdash; not a validated regulatory signal-detection result.
          </p>
        </div>
        <button className="signal-table-card__export" onClick={() => downloadCsv(rows, drugName)}>
          Download CSV
        </button>
      </div>

      <div className="signal-table-card__filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-pill${filter === f ? " filter-pill--active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--color-ink-soft)" }}>
          No reactions found for triage filter: <strong>{filter}</strong>
        </p>
      ) : (
        <div className="signal-table-card__scroll">
          <table className="signal-table">
            <thead>
              <tr>
                <th>Reaction</th>
                <th>Drug reports (a)</th>
                <th>Drug total (a+b)</th>
                <th>Drug rate</th>
                <th>Background rate</th>
                <th>PRR-inspired ratio</th>
                <th title="Chi-square with Yates' correction; 4 is roughly p &lt; 0.05">χ²</th>
                <th>Triage status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.reaction_term}
                  className={row.reaction_term === selectedReaction ? "signal-table__row--selected" : ""}
                  onClick={() => onSelectReaction(row.reaction_term)}
                  // Drives the status-coloured edge on the first cell, so a row's
                  // triage level is legible without reading across to the badge.
                  style={{ "--row-status": triageColor(row.triage_label) }}
                >
                  <td>{row.reaction_term}</td>
                  <td className="mono">{row.drug_event_count}</td>
                  <td className="mono">{row.drug_total_reports}</td>
                  <td className="mono">{row.drug_event_rate !== null ? `${(row.drug_event_rate * 100).toFixed(1)}%` : "\u2014"}</td>
                  <td className="mono">{row.comparator_event_rate !== null ? `${(row.comparator_event_rate * 100).toFixed(1)}%` : "\u2014"}</td>
                  <td className="mono">{row.prr !== null ? row.prr : "\u2014"}</td>
                  <td className="mono">
                    {row.chi_square !== null && row.chi_square !== undefined
                      ? row.chi_square
                      : "\u2014"}
                  </td>
                  <td>
                    <span className="triage-badge" style={{ background: triageColor(row.triage_label) }}>
                      {row.triage_label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
