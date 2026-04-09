const fs = require("fs-extra");
const path = require("path");
const AdmZip = require("adm-zip");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { detectServicesFromFiles } = require("./detectorService");

/**
 * GitHub API client — uses GITHUB_TOKEN from .env
 */
function ghClient() {
  return axios.create({
    baseURL: "https://api.github.com",
    timeout: 20000,
    headers: {
      "User-Agent": "code-to-cloud-app",
      "Accept": "application/vnd.github.v3+json",
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
    },
  });
}

// ─────────────────────────────────────────────
// ZIP UPLOAD (local, no network)
// ─────────────────────────────────────────────

async function analyzeFromZip(zipPath) {
  const extractDir = path.join(__dirname, "../uploads", uuidv4());
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractDir, true);
    return await detectServicesFromFiles(extractDir);
  } finally {
    await fs.remove(zipPath).catch(() => {});
    await fs.remove(extractDir).catch(() => {});
  }
}

// ─────────────────────────────────────────────
// GITHUB URL (uses GitHub API with token)
// ─────────────────────────────────────────────

async function analyzeFromGitHub(repoUrl) {
  const match = repoUrl.trim().match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (!match) {
    throw new Error("Invalid GitHub URL. Expected: https://github.com/owner/repo");
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  const gh = ghClient();

  console.log(`[GitHub] Fetching: ${owner}/${cleanRepo}`);

  // 1. Get repo info (default branch)
  let defaultBranch = "main";
  try {
    const { data } = await gh.get(`/repos/${owner}/${cleanRepo}`);
    defaultBranch = data.default_branch || "main";
    console.log(`[GitHub] Default branch: ${defaultBranch}`);
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    throw new Error(`Cannot access repo "${owner}/${cleanRepo}": ${msg}`);
  }

  // 2. Get full file tree
  let tree = [];
  try {
    const { data } = await gh.get(
      `/repos/${owner}/${cleanRepo}/git/trees/${defaultBranch}?recursive=1`
    );
    tree = data.tree.filter((f) => f.type === "blob").map((f) => f.path);
    console.log(`[GitHub] Files in tree: ${tree.length}`);
  } catch (err) {
    throw new Error(`Failed to fetch file tree: ${err.response?.data?.message || err.message}`);
  }

  // 3. Fetch content of key detection files in parallel
  const KEY_FILES = [
    "package.json", "requirements.txt", "pyproject.toml",
    "go.mod", "pom.xml", "build.gradle", "Gemfile",
    "docker-compose.yml", "docker-compose.yaml",
    ".env.example", ".env.sample",
  ];

  const targets = tree
    .filter((f) => KEY_FILES.includes(path.basename(f)))
    .slice(0, 12);

  const fileContents = {};

  await Promise.allSettled(
    targets.map(async (filePath) => {
      try {
        const { data } = await gh.get(`/repos/${owner}/${cleanRepo}/contents/${filePath}`);
        if (data.encoding === "base64") {
          fileContents[filePath] = Buffer.from(data.content, "base64").toString("utf-8");
          console.log(`[GitHub] Fetched: ${filePath}`);
        }
      } catch {
        // skip unreadable files silently
      }
    })
  );

  // 4. Run detection
  const result = await detectServicesFromFiles(null, { tree, fileContents });
  result.repoUrl = `https://github.com/${owner}/${cleanRepo}`;
  return result;
}

module.exports = { analyzeFromZip, analyzeFromGitHub };
