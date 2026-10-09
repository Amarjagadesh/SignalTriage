import { useMemo } from "react";
import { smoothPath } from "../utils/chartGeometry";

/*
 * Decorative scientific backdrop for the analysis section.
 *
 * Purely presentational: aria-hidden, pointer-events none, and behind every
 * content layer. It renders nothing derived from the analysis, so it can never
 * be mistaken for data.
 *
 * Geometry is computed rather than drawn by hand, and reuses the same
 * smoothPath the charts use, so the curves here are the same family of shapes
 * as the real ones -- which is what makes it read as an instrument backdrop
 * rather than as decoration bolted on.
 *
 * Everything sits between 0.02 and 0.14 opacity. It has to survive being
 * looked past, not looked at.
 */

const W = 1600;
const H = 1000;

const GOLDEN_ANGLE = 2.39996;

function helixStrand(phase) {
  const points = [];
  for (let i = 0; i <= 24; i++) {
    points.push({
      x: 1332 + Math.sin(i * 0.52 + phase) * 78,
      y: -40 + i * 45,
    });
  }
  return smoothPath(points, { tension: 0.95 });
}

function helixRungs() {
  const rungs = [];
  for (let i = 1; i < 24; i++) {
    const y = -40 + i * 45;
    rungs.push({
      x1: 1332 + Math.sin(i * 0.52) * 78,
      x2: 1332 + Math.sin(i * 0.52 + Math.PI) * 78,
      y,
      // Rungs seen edge-on are shorter and fainter -- the cue that sells
      // depth in a flat two-strand drawing.
      fade: 0.25 + Math.abs(Math.sin(i * 0.52)) * 0.75,
    });
  }
  return rungs;
}

function moleculeRing(cx, cy, radius) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });
}

function waveform(baseline, amplitude, phase, steps = 26) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: t * W,
      // Three summed harmonics: enough irregularity to look measured rather
      // than generated from a single sine.
      y:
        baseline +
        Math.sin(t * 7.5 + phase) * amplitude +
        Math.sin(t * 3.1 + phase * 1.7) * amplitude * 0.55 +
        Math.sin(t * 13.7 + phase * 0.4) * amplitude * 0.22,
    });
  }
  return smoothPath(points, { tension: 0.9 });
}

function particles(count) {
  // Golden-angle scatter: even coverage with no visible lattice, and fully
  // deterministic so the backdrop does not shuffle between renders.
  return Array.from({ length: count }, (_, i) => {
    const angle = i * GOLDEN_ANGLE;
    const radius = Math.sqrt(i / count);
    return {
      x: W / 2 + Math.cos(angle) * radius * W * 0.62,
      y: H / 2 + Math.sin(angle) * radius * H * 0.72,
      r: 0.9 + ((i * 37) % 5) * 0.42,
      o: 0.05 + ((i * 17) % 7) * 0.014,
    };
  });
}

export function AnalysisBackdrop() {
  const scene = useMemo(
    () => ({
      strandA: helixStrand(0),
      strandB: helixStrand(Math.PI),
      rungs: helixRungs(),
      hexOuter: moleculeRing(232, 236, 96),
      hexInner: moleculeRing(232, 236, 46),
      trace: waveform(742, 46, 0),
      traceEcho: waveform(770, 34, 2.2),
      dots: particles(120),
    }),
    []
  );

  return (
    <div className="analysis-backdrop" aria-hidden="true">
      <svg
        className="analysis-backdrop__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id="ab-cyan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="ab-trace" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0" />
            <stop offset="35%" stopColor="#22D3EE" stopOpacity="0.55" />
            <stop offset="72%" stopColor="#818CF8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#E879F9" stopOpacity="0" />
          </linearGradient>
          {/* Depth of field: the far layer is blurred, the near layer is not. */}
          <filter id="ab-far" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        {/* --- far layer: out of focus --- */}
        <g filter="url(#ab-far)" opacity="0.5">
          <circle cx="1210" cy="812" r="190" fill="none" stroke="#22D3EE" strokeWidth="1.5" />
          <circle cx="1210" cy="812" r="132" fill="none" stroke="#818CF8" strokeWidth="1.5" />
          <circle cx="1210" cy="812" r="74" fill="none" stroke="#22D3EE" strokeWidth="1.5" />
          <path d={scene.traceEcho} fill="none" stroke="#818CF8" strokeWidth="2.5" />
        </g>

        {/* --- particles: scattered data points --- */}
        <g>
          {scene.dots.map((dot, i) => (
            <circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill="#9FD8EC" opacity={dot.o} />
          ))}
        </g>

        {/* --- molecular structure --- */}
        <g opacity="0.5">
          <polygon
            points={scene.hexOuter.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#22D3EE"
            strokeWidth="1.2"
            opacity="0.5"
          />
          <polygon
            points={scene.hexInner.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#818CF8"
            strokeWidth="1"
            opacity="0.4"
          />
          {scene.hexOuter.map((p, i) => (
            <g key={i}>
              <line
                x1={232}
                y1={236}
                x2={p.x}
                y2={p.y}
                stroke="#7FB6D0"
                strokeWidth="0.8"
                opacity="0.28"
              />
              <circle cx={p.x} cy={p.y} r="4.5" fill="#22D3EE" opacity="0.32" />
            </g>
          ))}
          <circle cx="232" cy="236" r="7" fill="#818CF8" opacity="0.4" />
        </g>

        {/* --- genomic double helix --- */}
        <g opacity="0.62">
          {scene.rungs.map((rung, i) => (
            <line
              key={i}
              x1={rung.x1}
              y1={rung.y}
              x2={rung.x2}
              y2={rung.y}
              stroke="#7FB6D0"
              strokeWidth="1.1"
              opacity={0.1 + rung.fade * 0.2}
            />
          ))}
          <path d={scene.strandA} fill="none" stroke="url(#ab-cyan)" strokeWidth="2.2" />
          <path d={scene.strandB} fill="none" stroke="url(#ab-cyan)" strokeWidth="2.2" />
        </g>

        {/* --- foreground data trace --- */}
        <path
          d={scene.trace}
          fill="none"
          stroke="url(#ab-trace)"
          strokeWidth="2.4"
          opacity="0.55"
        />

        {/* --- sequence ladder, echoing an electrophoresis gel --- */}
        <g opacity="0.16">
          {Array.from({ length: 26 }, (_, i) => (
            <rect
              key={i}
              x={92 + i * 22}
              y={556 - ((i * 53) % 9) * 5}
              width="7"
              height={26 + ((i * 31) % 7) * 7}
              rx="3"
              fill="#22D3EE"
              opacity={0.3 + ((i * 13) % 5) * 0.13}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
