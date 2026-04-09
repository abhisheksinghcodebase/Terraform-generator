const fs = require("fs-extra");
const path = require("path");
const AdmZip = require("adm-zip");
const simpleGit = require("simple-git");
const { v4: uuidv4 } = require("uuid");
const { detectServices } = require("./detectorService");

/**
 * Analyze a ZIP file upload
 */
async function analyzeFromZip(zipPath) {
  const extractDir = path.join(__dirname, "../uploads", uuidv4());
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractDir, true);
    const result = await detectServices(extractDir);
    return result;
  } finally {
    // Cleanup
    await fs.remove(zipPath).catch(() => {});
    await fs.remove(extractDir).catch(() => {});
  }
}

/**
 * Clone a GitHub repo and analyze it
 */
async function analyzeFromGitHub(repoUrl) {
  const cloneDir = path.join(__dirname, "../uploads", uuidv4());
  try {
    // Normalize URL — strip .git suffix if present
    const normalizedUrl = repoUrl.trim().replace(/\.git$/, "") + ".git";
    await simpleGit().clone(normalizedUrl, cloneDir, ["--depth", "1"]);
    const result = await detectServices(cloneDir);
    return result;
  } finally {
    await fs.remove(cloneDir).catch(() => {});
  }
}

module.exports = { analyzeFromZip, analyzeFromGitHub };
