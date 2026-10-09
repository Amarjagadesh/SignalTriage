// The only file in the app that knows the backend's URL and endpoint shape.
// If the backend moves or changes, this is the one place to update.

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function fetchAnalysis(drug, { live = true, limit = 100 } = {}) {
  const params = new URLSearchParams({ drug, live, limit });
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze?${params}`);
  } catch {
    throw new Error(
      `Unable to connect to the backend server at ${API_BASE_URL}. Please verify that api_server.py is running on port 8000.`,
    );
  }

  if (!response.ok) {
    let errorDetail = `Server error (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail += `: ${errJson.detail}`;
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const data = await response.json();

  if (data.error) {
    // This is the backend's own "no data found" message, not a network failure.
    throw new Error(data.error);
  }

  return data;
}

export async function fetchSupportedDrugs() {
  const response = await fetch(`${API_BASE_URL}/api/drugs`);
  if (!response.ok) {
    throw new Error("Could not load the list of supported drugs.");
  }
  const data = await response.json();
  return data.drugs;
}
