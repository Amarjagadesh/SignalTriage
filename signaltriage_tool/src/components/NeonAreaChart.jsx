import { useId, useMemo, useState } from "react";
import { smoothPath, smoothAreaPath, niceTicks, truncate } from "../utils/chartGeometry";

/* Keeps a tooltip anchored to an edge point from sticking out of the panel. */
const clampPercent = (value) => Math.min(Math.max(value, 16), 84);

/*
 * A smooth area chart for ordered categories.
 *
 * Used for anything where the x axis has a natural sequence -- age bands, for
 * instance -- because a curve reads as a distribution in a way that a row of
 * separate bars does not.
 */

const W = 640;
const H = 260;
const PAD = { top: 22, right: 20, bottom: 42, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const BASE_Y = PAD.top + PLOT_H;

export function NeonAreaChart({
  data = [],
  color = "var(--chart-1)",
  valueLabel = "reports",
  labelChars = 7,
}) {
  // useId keeps gradient/filter ids unique -- several charts share a page and
  // duplicate ids would make them all reference whichever rendered last.
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null);

  const { points, ticks, maxY } = useMemo(() => {
    if (!data.length) return { points: [], ticks: [0], maxY: 1 };

    const peak = Math.max(...data.map((d) => d.value), 1);
    const tickValues = niceTicks(peak, 4);
    const ceiling = Math.max(tickValues[tickValues.length - 1], peak);

    const mapped = data.map((entry, index) => ({
      ...entry,
      x:
        PAD.left +
        (data.length === 1 ? PLOT_W / 2 : (index / (data.length - 1)) * PLOT_W),
      y: BASE_Y - (entry.value / ceiling) * PLOT_H,
    }));

    return { points: mapped, ticks: tickValues, maxY: ceiling };
  }, [data]);

  if (!points.length) {
    return <p className="chart-empty">No data recorded</p>;
  }

  const curve = { tension: 0.85, top: PAD.top, bottom: BASE_Y };
  const linePath = smoothPath(points, curve);
  const areaPath = smoothAreaPath(points, BASE_Y, curve);

  return (
    <div className="neon-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Distribution by ${valueLabel}`}>
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.42" />
            <stop offset="55%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          {/* The bloom that makes the stroke read as neon rather than as a
              plain 2px line on a dark ground. */}
          <filter id={`${uid}-glow`} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {ticks.map((tick) => {
          const y = BASE_Y - (tick / maxY) * PLOT_H;
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
              <text x={PAD.left - 10} y={y + 4} textAnchor="end" className="chart-axis-label mono">
                {tick}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={`url(#${uid}-fill)`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${uid}-glow)`}
          className="neon-chart__line"
        />

        {points.map((point) => {
          const active = hover?.label === point.label;
          return (
            <g key={point.label}>
              {active && (
                <line
                  x1={point.x}
                  y1={PAD.top}
                  x2={point.x}
                  y2={BASE_Y}
                  stroke={color}
                  strokeWidth="1"
                  strokeOpacity="0.45"
                  strokeDasharray="3 3"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={active ? 6 : 4}
                fill="#0B1A21"
                stroke={color}
                strokeWidth="2.2"
                filter={active ? `url(#${uid}-glow)` : undefined}
              />
              {/* Generous invisible hit area -- a 4px dot is not a pointer target. */}
              <circle
                cx={point.x}
                cy={point.y}
                r="20"
                fill="transparent"
                onMouseEnter={() => setHover(point)}
                onMouseLeave={() => setHover(null)}
              />
              <text x={point.x} y={H - 16} textAnchor="middle" className="chart-axis-label">
                {truncate(point.label, labelChars)}
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
          <span className="chart-tooltip__label">{hover.label}</span>
          <span className="chart-tooltip__value mono" style={{ color }}>
            {hover.value.toLocaleString()} {valueLabel}
          </span>
        </div>
      )}
    </div>
  );
}
