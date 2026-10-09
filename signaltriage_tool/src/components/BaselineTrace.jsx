import { useId, useMemo, useState } from "react";
import { triageColor } from "../utils/triageColors";
import { smoothPath, smoothAreaPath, niceTicks, truncate } from "../utils/chartGeometry";

/* Keeps a tooltip anchored to an edge point from sticking out of the panel. */
const clampPercent = (value) => Math.min(Math.max(value, 12), 88);

/*
 * The signature visual: reporting ratio across the most-reported reactions,
 * read against the background rate.
 *
 * The x axis is the drug's reactions ranked by how often they were reported,
 * and the y axis is the PRR-inspired ratio. The dashed line at 1.0 is the
 * whole point of the chart -- it is the "reported exactly as often as
 * expected" level, so everything above it is the disproportionate reporting
 * the triage table then ranks.
 *
 * Reactions with no comparator rate are omitted rather than plotted at zero:
 * a missing background rate is not the same as a low one, and drawing it as
 * one would invent a signal that the data does not support.
 */

const W = 900;
const H = 320;
const PAD = { top: 26, right: 24, bottom: 52, left: 50 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const BASE_Y = PAD.top + PLOT_H;
const MAX_POINTS = 8;

export function BaselineTrace({ signalTable }) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null);

  const { points, ticks, ceiling } = useMemo(() => {
    const rows = signalTable
      .filter((row) => typeof row.prr === "number" && Number.isFinite(row.prr))
      .sort((a, b) => b.drug_event_count - a.drug_event_count)
      .slice(0, MAX_POINTS);

    if (!rows.length) return { points: [], ticks: [0], ceiling: 1 };

    const peak = Math.max(...rows.map((row) => row.prr), 2);
    const tickValues = niceTicks(peak * 1.12, 4);
    const top = Math.max(tickValues[tickValues.length - 1], peak);

    const mapped = rows.map((row, index) => ({
      ...row,
      x:
        PAD.left +
        (rows.length === 1 ? PLOT_W / 2 : (index / (rows.length - 1)) * PLOT_W),
      y: BASE_Y - (row.prr / top) * PLOT_H,
      color: triageColor(row.triage_label),
    }));

    return { points: mapped, ticks: tickValues, ceiling: top };
  }, [signalTable]);

  if (!points.length) return null;

  const curve = { tension: 0.85, top: PAD.top, bottom: BASE_Y };
  const linePath = smoothPath(points, curve);
  const areaPath = smoothAreaPath(points, BASE_Y, curve);
  const baselineY = BASE_Y - (1 / ceiling) * PLOT_H;

  return (
    <div className="baseline-trace">
      <div className="baseline-trace__head">
        <h2>Reporting ratio against background</h2>
        <p className="baseline-trace__caption">
          Most-reported reactions, plotted by PRR-inspired ratio. Anything above
          the dashed line was reported more often than the comparator baseline.
        </p>
      </div>

      <div className="neon-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Reaction reporting ratio relative to background rate">
          <defs>
            <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.4" />
              <stop offset="50%" stopColor="var(--chart-2)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-stroke`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-1)" />
              <stop offset="60%" stopColor="var(--chart-2)" />
              <stop offset="100%" stopColor="var(--chart-3)" />
            </linearGradient>
            <filter id={`${uid}-glow`} x="-15%" y="-40%" width="130%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {ticks.map((tick) => {
            const y = BASE_Y - (tick / ceiling) * PLOT_H;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={W - PAD.right}
                  y2={y}
                  stroke={tick === 0 ? "var(--chart-grid-strong)" : "var(--chart-grid)"}
                  strokeWidth="1"
                />
                <text x={PAD.left - 12} y={y + 4} textAnchor="end" className="chart-axis-label mono">
                  {tick}×
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill={`url(#${uid}-fill)`} />
          <path
            d={linePath}
            fill="none"
            stroke={`url(#${uid}-stroke)`}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${uid}-glow)`}
            className="baseline-trace__line"
          />

          {/* The expected-reporting level: the reference every point is read against. */}
          <line
            x1={PAD.left}
            y1={baselineY}
            x2={W - PAD.right}
            y2={baselineY}
            stroke="var(--color-background-level)"
            strokeWidth="1.4"
            strokeDasharray="6 5"
            strokeOpacity="0.85"
          />
          <text
            x={W - PAD.right}
            y={baselineY - 9}
            textAnchor="end"
            className="baseline-trace__baseline-label mono"
          >
            background rate (1.0×)
          </text>

          {points.map((point) => {
            const active = hover?.reaction_term === point.reaction_term;
            return (
              <g key={point.reaction_term}>
                {active && (
                  <line
                    x1={point.x}
                    y1={PAD.top}
                    x2={point.x}
                    y2={BASE_Y}
                    stroke={point.color}
                    strokeWidth="1"
                    strokeOpacity="0.5"
                    strokeDasharray="3 3"
                  />
                )}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={active ? 7 : 5}
                  fill="#0A1920"
                  stroke={point.color}
                  strokeWidth="2.4"
                  filter={`url(#${uid}-glow)`}
                  className="baseline-trace__dot"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="22"
                  fill="transparent"
                  onMouseEnter={() => setHover(point)}
                  onMouseLeave={() => setHover(null)}
                />
                <text x={point.x} y={H - 18} textAnchor="middle" className="chart-axis-label">
                  {truncate(point.reaction_term, 13)}
                </text>
              </g>
            );
          })}
        </svg>

        {hover && (
          <div
            className="chart-tooltip"
            style={{ left: `${clampPercent((hover.x / W) * 100)}%`, top: `${(hover.y / H) * 100}%` }}
          >
            <span className="chart-tooltip__label">{hover.reaction_term}</span>
            <span className="chart-tooltip__value mono" style={{ color: hover.color }}>
              {hover.prr}× background
            </span>
            <span className="chart-tooltip__meta mono">
              {hover.drug_event_count} of {hover.drug_total_reports} reports
            </span>
            <span className="chart-tooltip__status" style={{ color: hover.color }}>
              {hover.triage_label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
