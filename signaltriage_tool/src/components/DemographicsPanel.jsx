import { useMemo } from "react";
import { NeonAreaChart } from "./NeonAreaChart";
import { NeonDonut } from "./NeonDonut";

/*
 * Demographic summary.
 *
 * Age is the one dimension here with a natural order, so it gets a curve --
 * a distribution you can read the shape of. Sex and seriousness are unordered
 * splits of a whole, which is what a donut is actually for. Sorting age bands
 * by frequency (as a plain count list does) destroys the only information the
 * axis carries, so they are sorted by band instead.
 */

const AGE_ORDER = ["<18", "18-30", "31-45", "46-60", "61-75", "76-90", ">90", "Unknown"];

function toSortedEntries(counts, order) {
  const entries = Object.entries(counts || {}).map(([label, value]) => ({ label, value }));
  if (!order) return entries.sort((a, b) => b.value - a.value);

  return entries.sort((a, b) => {
    const ai = order.indexOf(a.label);
    const bi = order.indexOf(b.label);
    // Unrecognised bands fall to the end rather than to the front.
    return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
  });
}

export function DemographicsPanel({ demographics = {} }) {
  const demo = demographics || {};

  const ageEntries = useMemo(() => toSortedEntries(demo.age_group, AGE_ORDER), [demo.age_group]);
  const sexEntries = useMemo(() => toSortedEntries(demo.sex), [demo.sex]);
  const seriousEntries = useMemo(() => toSortedEntries(demo.serious), [demo.serious]);

  return (
    <div className="demographics-card">
      <div className="demographics-card__head">
        <h2>Demographic summary</h2>
        <p className="demographics-card__caption">
          Distribution across retrieved reports; records missing a value are excluded.
        </p>
      </div>

      <div className="demographics-card__grid">
        <section className="demo-panel demo-panel--wide">
          <h3 className="demo-panel__title">Age distribution</h3>
          <NeonAreaChart data={ageEntries} color="var(--chart-1)" valueLabel="reports" />
        </section>

        <section className="demo-panel">
          <h3 className="demo-panel__title">Reported sex</h3>
          <NeonDonut data={sexEntries} centerLabel="reports" />
        </section>

        <section className="demo-panel">
          <h3 className="demo-panel__title">Seriousness</h3>
          <NeonDonut data={seriousEntries} centerLabel="reports" />
        </section>
      </div>
    </div>
  );
}
