const path = require("path");
const { walkDir, readFileSafe } = require("../utils/fileUtils");

// ─────────────────────────────────────────────
// PUBLIC ENTRY POINTS
// ─────────────────────────────────────────────

/**
 * Detect services from a local directory (ZIP upload path)
 */
async function detectServicesFromFiles(rootDir, virtual = null) {
  if (virtual) {
    return detectFromVirtual(virtual);
  }
  return detectFromDisk(rootDir);
}

// ─────────────────────────────────────────────
// DISK-BASED DETECTION (ZIP upload)
// ─────────────────────────────────────────────

async function detectFromDisk(rootDir) {
  const allFiles = await walkDir(rootDir);
  const relativeFiles = allFiles.map((f) => path.relative(rootDir, f));

  const fileContents = {};
  const KEY_FILES = [
    "package.json", "requirements.txt", "pyproject.toml",
    "go.mod", "pom.xml", "build.gradle",
  ];

  for (const absPath of allFiles) {
    const base = path.basename(absPath);
    if (KEY_FILES.includes(base)) {
      fileContents[path.relative(rootDir, absPath)] = await readFileSafe(absPath);
    }
  }

  const { ports, envVars } = await scanForPortsAndEnv(allFiles);
  const services = await detectServicesFromTree(relativeFiles, fileContents);

  if (services.length === 0) {
    services.push({ type: "backend", language: "unknown", folder: "." });
  }

  assignPorts(services, ports);

  // Docker detection
  const hasDocker = relativeFiles.some((f) => {
    const base = path.basename(f).toLowerCase();
    return base === "dockerfile" || base === "docker-compose.yml" || base === "docker-compose.yaml";
  });

  return {
    services,
    hasDocker,
    detectedFiles: relativeFiles.slice(0, 50),
    envVars: [...new Set(envVars)],
    summary: buildSummary(services, hasDocker),
  };
}

// ─────────────────────────────────────────────
// VIRTUAL DETECTION (GitHub API path)
// ─────────────────────────────────────────────

async function detectFromVirtual({ tree, fileContents }) {
  const services = await detectServicesFromTree(tree, fileContents);

  if (services.length === 0) {
    services.push({ type: "backend", language: "unknown", folder: "." });
  }

  const envVars = [];
  for (const content of Object.values(fileContents)) {
    extractEnvVars(content).forEach((v) => envVars.push(v));
  }

  // Docker detection from file tree
  const hasDocker = tree.some((f) => {
    const base = path.basename(f).toLowerCase();
    return base === "dockerfile" || base === "docker-compose.yml" || base === "docker-compose.yaml";
  });

  return {
    services,
    hasDocker,
    detectedFiles: tree.slice(0, 50),
    envVars: [...new Set(envVars)],
    summary: buildSummary(services, hasDocker),
  };
}

// ─────────────────────────────────────────────
// CORE DETECTION LOGIC
// ─────────────────────────────────────────────

async function detectServicesFromTree(filePaths, fileContents) {
  const folderMap = buildFolderMap(filePaths);
  const services = [];

  for (const [folder, files] of Object.entries(folderMap)) {
    const svc = detectServiceInFolder(folder, files, fileContents);
    if (svc) services.push(svc);
  }

  // If nothing found in subfolders, try root
  if (services.length === 0) {
    const svc = detectServiceInFolder(".", filePaths, fileContents);
    if (svc) services.push(svc);
  }

  return services;
}

function detectServiceInFolder(folder, files, fileContents) {
  const fileNames = files.map((f) => path.basename(f).toLowerCase());

  let language = null, framework = null, serviceType = null, database = null;

  // ── Node.js ──
  if (fileNames.includes("package.json")) {
    language = "nodejs";
    // Find the matching package.json content
    const pkgContent = Object.entries(fileContents).find(([k]) =>
      k === "package.json" || k.endsWith(`${folder}/package.json`) || k.endsWith(`${folder}\\package.json`)
    )?.[1] || "";

    const deps = extractDependencyKeys(pkgContent);

    if (deps.includes("express"))        { framework = "express";  serviceType = "backend"; }
    else if (deps.includes("fastify"))   { framework = "fastify";  serviceType = "backend"; }
    else if (deps.includes("koa"))       { framework = "koa";      serviceType = "backend"; }
    else if (deps.includes("@nestjs/core")) { framework = "nestjs"; serviceType = "backend"; }

    if (deps.includes("next"))           { framework = "nextjs";   serviceType = "frontend"; }
    else if (deps.includes("react") && !framework) { framework = "react"; serviceType = "frontend"; }
    else if (deps.includes("vue"))       { framework = "vue";      serviceType = "frontend"; }

    if (deps.includes("mongoose") || deps.includes("mongodb"))  database = "mongodb";
    if (deps.includes("pg") || deps.includes("sequelize") || deps.includes("typeorm")) database = "postgresql";
    if (deps.includes("mysql2") || deps.includes("mysql"))      database = "mysql";
    if (deps.includes("redis") || deps.includes("ioredis"))     database = "redis";
  }

  // ── Python ──
  if (fileNames.includes("requirements.txt") || fileNames.includes("pyproject.toml")) {
    language = "python";
    const reqContent = Object.entries(fileContents).find(([k]) =>
      k === "requirements.txt" || k.endsWith("requirements.txt")
    )?.[1] || "";

    if (/\bflask\b/i.test(reqContent))   { framework = "flask";   serviceType = "backend"; }
    if (/\bdjango\b/i.test(reqContent))  { framework = "django";  serviceType = "backend"; }
    if (/\bfastapi\b/i.test(reqContent)) { framework = "fastapi"; serviceType = "backend"; }

    if (/psycopg2|sqlalchemy/i.test(reqContent)) database = "postgresql";
    if (/pymongo/i.test(reqContent))             database = "mongodb";
    if (/mysql-connector|pymysql/i.test(reqContent)) database = "mysql";
    if (/\bredis\b/i.test(reqContent))           database = "redis";
  }

  // ── Go ──
  if (fileNames.includes("go.mod")) { language = "go"; serviceType = "backend"; }

  // ── Java ──
  if (fileNames.includes("pom.xml") || fileNames.includes("build.gradle")) {
    language = "java"; serviceType = "backend";
  }

  if (!language) return null;
  if (!serviceType) serviceType = "backend";

  const svc = { type: serviceType, language, folder };
  if (framework) svc.framework = framework;
  if (database)  svc.database  = database;
  return svc;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function buildFolderMap(files) {
  const map = {};
  for (const f of files) {
    const parts = f.replace(/\\/g, "/").split("/");
    const folder = parts.length > 1 ? parts[0] : ".";
    if (!map[folder]) map[folder] = [];
    map[folder].push(f);
  }
  return map;
}

function extractDependencyKeys(pkgJson) {
  try {
    const parsed = JSON.parse(pkgJson);
    return [
      ...Object.keys(parsed.dependencies || {}),
      ...Object.keys(parsed.devDependencies || {}),
    ].map((k) => k.toLowerCase());
  } catch {
    return [];
  }
}

async function scanForPortsAndEnv(allFiles) {
  const ports = new Set();
  const envVars = [];
  for (const file of allFiles) {
    if (/\.(js|ts|py|env|yaml|yml)$/.test(file)) {
      const content = await readFileSafe(file);
      extractPorts(content).forEach((p) => ports.add(p));
      extractEnvVars(content).forEach((v) => envVars.push(v));
    }
  }
  return { ports: [...ports], envVars };
}

function extractPorts(content) {
  const matches = content.match(/(?:PORT|port|listen)\s*[=:]\s*(\d{2,5})/g) || [];
  return matches
    .map((m) => parseInt(m.match(/\d{2,5}/)?.[0]))
    .filter((p) => p >= 80 && p <= 65535);
}

function extractEnvVars(content) {
  const matches = content.match(/process\.env\.([A-Z_][A-Z0-9_]+)|os\.environ\.get\(['"]([A-Z_][A-Z0-9_]+)['"]\)/g) || [];
  return matches.map((m) => m.replace(/process\.env\.|os\.environ\.get\(['"]|['"]\)/g, ""));
}

function assignPorts(services, ports) {
  services.forEach((svc, i) => {
    if (!svc.port && ports[i]) svc.port = ports[i];
  });
}

function buildSummary(services, hasDocker = false) {
  const types = services.map((s) => s.framework || s.language || s.type).join(", ");
  const dbs = services.filter((s) => s.database).map((s) => s.database).join(", ");
  const docker = hasDocker ? " | 🐳 Docker detected" : "";
  return `Detected: ${types || "unknown"}${dbs ? ` | Databases: ${dbs}` : ""}${docker}`;
}

module.exports = { detectServicesFromFiles };
