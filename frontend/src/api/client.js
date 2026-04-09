import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "";

/**
 * Analyze a repo — accepts either { repoUrl } or { zipFile: File }
 */
export async function analyzeRepo(payload) {
  if (payload.zipFile) {
    const form = new FormData();
    form.append("zipFile", payload.zipFile);
    const { data } = await axios.post(`${BASE}/analyze`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } else {
    const { data } = await axios.post(`${BASE}/analyze`, { repoUrl: payload.repoUrl });
    return data;
  }
}

/**
 * Generate Terraform from analysis JSON
 */
export async function generateTerraform(analysis) {
  const { data } = await axios.post(`${BASE}/generate`, analysis);
  return data;
}
