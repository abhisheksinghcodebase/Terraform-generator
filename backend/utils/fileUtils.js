const fs = require("fs-extra");
const path = require("path");

// Directories to skip during scanning
const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".github", "dist", "build",
  "__pycache__", ".venv", "venv", ".next", "coverage",
  ".terraform", "vendor",
]);

/**
 * Recursively walk a directory and return all file paths.
 * Skips common non-source directories.
 */
async function walkDir(dir, results = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, results);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Safely read a file — returns empty string on error
 */
async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

module.exports = { walkDir, readFileSafe };
