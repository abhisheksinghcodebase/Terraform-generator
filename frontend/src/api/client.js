import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "";

/**
 * Extract a readable error message from an axios error.
 * Prefers the backend's { error: "..." } JSON body over the generic axios message.
 */
function extractError(err) {
  if (err.code === "ECONNABORTED") {
    return "Request timed out. The server is taking too long — please try again.";
  }
  return err.response?.data?.error || err.message || "Unknown error";
}

/**
 * Analyze a repo — accepts either { repoUrl } or { zipFile: File }
 * Timeout: 45s (just a download + file scan, should be fast)
 */
export async function analyzeRepo(payload) {
  try {
    if (payload.zipFile) {
      const form = new FormData();
      form.append("zipFile", payload.zipFile);
      const { data } = await axios.post(`${BASE}/analyze`, form, {
        timeout: 60_000,
      });
      return data;
    } else {
      const { data } = await axios.post(`${BASE}/analyze`, { repoUrl: payload.repoUrl }, {
        timeout: 60_000,
      });
      return data;
    }
  } catch (err) {
    throw new Error(extractError(err));
  }
}

/**
 * Generate IaC from analysis JSON.
 * Timeout: 240s — covers Gemini retries on rate-limit (10s + 20s backoff × 3)
 * @param {object} analysis - result from /analyze
 * @param {"terraform"|"cloudformation"} format
 */
export async function generateIaC(analysis, format = "terraform") {
  try {
    const { data } = await axios.post(`${BASE}/generate`, { ...analysis, format }, {
      timeout: 180_000, // 3 min — covers 2 model fallbacks × 3 retries × 15s wait
    });
    return data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}
