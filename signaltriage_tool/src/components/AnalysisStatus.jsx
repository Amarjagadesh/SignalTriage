import { useEffect, useState } from "react";

/*
 * Progressive status text shown while an analysis is in flight.
 *
 * These describe what the tool does during the wait; they are not progress
 * reporting. The backend returns one response at the end, so the frontend has
 * no way to know which stage is actually running -- which is exactly why each
 * line is phrased as an ongoing activity and none of them ever claims a step
 * finished. Saying "PRR computed" on a timer would be inventing a fact.
 */

const STAGES = [
  "Fetching adverse-event reports from FAERS…",
  "Computing reporting ratios (PRR)…",
  "Testing statistical significance (χ²)…",
  "Ranking and triaging signals…",
];

const STAGE_MS = 2000;

/*
 * Mounted only while loading, so unmounting resets the sequence -- no need to
 * zero the stage from inside an effect, which would just queue an extra render.
 */
export function AnalysisStatus() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      // Holds on the last line rather than looping, so a slow request does not
      // appear to start over.
      setStage((current) => Math.min(current + 1, STAGES.length - 1));
    }, STAGE_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <p className="analysis-status" role="status" aria-live="polite">
      <span className="analysis-status__pulse" aria-hidden="true" />
      <span key={stage} className="analysis-status__text">
        {STAGES[stage]}
      </span>
    </p>
  );
}
