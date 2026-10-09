import { useId, useMemo, useState } from "react";

/*
 * A donut for small categorical splits (reported sex, serious vs non-serious).
 *
 * Segments are drawn as dash offsets on one circle rather than as arc paths --
 * fewer moving parts, and it means a segment can be widened on hover without
 * recomputing any geometry.
 */

const SIZE = 168;
const RADIUS = 62;
const THICKNESS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-6)",
];

export function NeonDonut({ data = [], centerLabel = "total" }) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null);

  const { segments, total } = useMemo(() => {
    const sum = data.reduce((acc, entry) => acc + entry.value, 0);
    if (!sum) return { segments: [], total: 0 };

    let cursor = 0;
    const built = data.map((entry, index) => {
      const fraction = entry.value / sum;
      const segment = {
        ...entry,
        color: SERIES[index % SERIES.length],
        fraction,
        length: fraction * CIRCUMFERENCE,
        offset: cursor,
      };
      cursor += segment.length;
      return segment;
    });

    return { segments: built, total: sum };
  }, [data]);

  if (!segments.length) {
    return <p className="chart-empty">No data recorded</p>;
  }

  return (
    <div className="neon-donut">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="neon-donut__svg" role="img" aria-label={centerLabel}>
        <defs>
          <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Rotated so segments start at twelve o'clock instead of three. */}
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(125, 176, 205, 0.1)"
            strokeWidth={THICKNESS}
          />
          {segments.map((segment) => {
            const active = hover?.label === segment.label;
            return (
              <circle
                key={segment.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={active ? THICKNESS + 5 : THICKNESS}
                strokeDasharray={`${segment.length} ${CIRCUMFERENCE - segment.length}`}
                strokeDashoffset={-segment.offset}
                strokeLinecap="butt"
                filter={active ? `url(#${uid}-glow)` : undefined}
                className="neon-donut__segment"
                onMouseEnter={() => setHover(segment)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </g>

        <text x={SIZE / 2} y={SIZE / 2 - 2} textAnchor="middle" className="neon-donut__total mono">
          {hover ? `${Math.round(hover.fraction * 100)}%` : total.toLocaleString()}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 16} textAnchor="middle" className="neon-donut__caption">
          {hover ? hover.label : centerLabel}
        </text>
      </svg>

      <ul className="neon-donut__legend">
        {segments.map((segment) => (
          <li
            key={segment.label}
            className={`neon-donut__legend-item${
              hover?.label === segment.label ? " neon-donut__legend-item--active" : ""
            }`}
            onMouseEnter={() => setHover(segment)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="neon-donut__swatch" style={{ background: segment.color }} />
            <span className="neon-donut__legend-label">{segment.label}</span>
            <span className="neon-donut__legend-value mono">{segment.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
