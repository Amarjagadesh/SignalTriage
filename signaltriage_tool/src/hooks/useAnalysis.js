import { useState, useCallback } from "react";
import { fetchAnalysis } from "../api/signalTriageApi";

/*
 * A "custom hook" is just a regular function that uses React's built-in
 * hooks (useState, useCallback) internally, so any component can call
 * useAnalysis() and get its own independent loading/error/data state
 * without copy-pasting this logic everywhere.
 *
 * We do NOT run the fetch automatically when the component loads --
 * runAnalysis() is only called when the user clicks "Analyze", matching
 * how the original Streamlit version worked (nothing happens until you
 * ask for it).
 */
export function useAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runAnalysis = useCallback(async (drug, options) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAnalysis(drug, options);
      setData(result);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, runAnalysis };
}
