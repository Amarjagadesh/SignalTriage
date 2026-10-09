/*
 * Chart maths shared by every visual in the dashboard.
 *
 * These are the few functions a charting library would have given us. Pulling
 * in Chart.js or ApexCharts for three small charts would cost far more bundle
 * than it saves -- and the hero already ships three.js -- so the curve fitting
 * and tick selection live here instead.
 */

/**
 * A smooth curve through every point, as an SVG path.
 *
 * Catmull-Rom converted to cubic Beziers: unlike a plain quadratic smoothing
 * pass, this passes exactly through each data point, which matters when the
 * points are real measurements someone might read off the axis.
 *
 * `tension` behaves like the option of the same name in charting libraries --
 * 0 gives straight segments, 1 gives the classic Catmull-Rom curve.
 *
 * Interpolation can overshoot on spiky data, so control points are clamped to
 * the plot box. Without it a sharp peak makes the curve dip below the axis and
 * the area fill bleeds outside the chart.
 */
export function smoothPath(points, { tension = 0.9, top = -Infinity, bottom = Infinity } = {}) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const clampY = (y) => Math.min(Math.max(y, top), bottom);
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const c1x = p1.x + ((p2.x - p0.x) * tension) / 6;
    const c1y = clampY(p1.y + ((p2.y - p0.y) * tension) / 6);
    const c2x = p2.x - ((p3.x - p1.x) * tension) / 6;
    const c2y = clampY(p2.y - ((p3.y - p1.y) * tension) / 6);

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
}

/** The same curve, closed down to a baseline, for the gradient area fill. */
export function smoothAreaPath(points, baselineY, options) {
  if (points.length < 2) return "";
  const line = smoothPath(points, options);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

/**
 * Axis ticks on round numbers (1/2/5 x 10^n) rather than max/n, so gridlines
 * land on values a reader can actually hold in their head.
 */
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0];

  const rough = max / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalised = rough / magnitude;
  const step =
    (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;

  const ticks = [];
  for (let value = 0; value <= max + step * 1e-6; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks;
}

/** Truncate a category label to fit its slot without wrapping. */
export function truncate(text, max) {
  const value = String(text ?? "");
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
