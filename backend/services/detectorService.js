const fs = require("fs-extra");
const path = require("path");
const { walkDir, readFileSafe } = require("../utils/fileUtils");

/**
 * Main detection entry point.
 * Walks the project directory and returns a structured analysis object.
 */
async function detectServices(rootDir) {
  const allFiles = await walkDir(rootDir);
  const relativeFiles = allFiles.map((f) => path.relative(rootDir, f));

  const services = [];
  const detectedPorts = new Set();
  const envVars = [];

  // --- Language & framework detection per folder ---
  const folderMap = buildFolderMap(relativeFiles);

  for (const [folder, files] of Object.entries(folderMap)) {
    const service = await detectServiceInFolder(rootDir, folder, files);
    if (service) services.push(service);
  }

  // If no sub-folder services found, treat root as single service
  if (services.length === 0) {
    const rootService = await detectServiceInFolder(rootDir, ".", relativeFiles);
    if (rootService) services.push(rootService);
  }

  // --- Port detection (scan all JS/PY files) ---
  for (const file of allFiles) {
    if (/\.(js|ts|py|env|yaml|yml)$/.test(file)) {
      const content = await readFileSafe(file);
      const ports = extractPorts(content);
      ports.forEach((p) => detectedPorts.add(p));
      const vars = extractEnvVars(content);
      vars.forEach((v) => envVars.push(v));
    }
  }

  // Assign ports to services
  const portList = [...detectedPorts];
  services.forEach((svc, i) => {
    if (!svc.port && portList[i]) svc.port = portList[i];
  });

  return {
    services,
    detectedFiles: relativeFiles.slice(0, 50), // sample
    envVars: [...new Set(envVars)],
    summary: buildSummary(services),
  };
}

/**
 * Group files by top-level folder (or root)
 */
function buildFolderMap(files) {
  const map = {};
  for (const f of files) {
    const parts = f.split(/[\\/]/);
    const folder = parts.length > 1 ? parts[0] : ".";
    if (!map[folder]) map[folder] = [];
    map[folder].push(f);
  }
  return map;
}

/**
 * Detect a single service from a folder's file list
 */
async function detectServiceInFolder(rootDir, folder, files) {
  const fileNames = files.map((f) => path.basename(f).toLowerCase());
  const filePaths = files.map((f) => f.toLowerCase());

  let language = null;
  let framework = null;
  let serviceType = null;
  let database = null;
  let port = null;

  // --- Language detection ---
  if (fileNames.includes("package.json")) {
    language = "nodejs";
    const pkgPath = path.join(rootDir, folder === "." ? "package.json" : `${folder}/package.json`);
    const pkg = await readFileSafe(pkgPath);
    const deps = extractDependencyKeys(pkg);

    // Framework
    if (deps.includes("express") || deps.includes("fastify") || deps.includes("koa")) {
      framework = deps.includes("express") ? "express" : deps.includes("fastify") ? "fastify" : "koa";
      serviceType = "backend";
    }
    if (deps.includes("react") || deps.includes("next") || deps.includes("vite")) {
      framework = deps.includes("next") ? "nextjs" : "react";
      serviceType = "frontend";
    }
    if (deps.includes("@nestjs/core")) { framework = "nestjs"; serviceType = "backend"; }

    // Database
    if (deps.includes("mongoose") || deps.includes("mongodb")) database = "mongodb";
    if (deps.includes("pg") || deps.includes("sequelize") || deps.includes("typeorm")) database = "postgresql";
    if (deps.includes("mysql") || deps.includes("mysql2")) database = "mysql";
    if (deps.includes("redis") || deps.includes("ioredis")) database = "redis";
  }

  if (fileNames.includes("requirements.txt") || fileNames.includes("pyproject.toml")) {
    language = "python";
    const reqPath = path.join(rootDir, folder === "." ? "requirements.txt" : `${folder}/requirements.txt`);
    const req = await readFileSafe(reqPath);

    if (/flask/i.test(req)) { framework = "flask"; serviceType = "backend"; }
    if (/django/i.test(req)) { framework = "django"; serviceType = "backend"; }
    if (/fastapi/i.test(req)) { framework = "fastapi"; serviceType = "backend"; }

    if (/psycopg2|sqlalchemy/i.test(req)) database = "postgresql";
    if (/pymongo/i.test(req)) database = "mongodb";
    if (/mysql-connector|pymysql/i.test(req)) database = "mysql";
    if (/redis/i.test(req)) database = "redis";
  }

  if (fileNames.includes("go.mod")) { language = "go"; serviceType = "backend"; }
  if (fileNames.includes("pom.xml") || fileNames.includes("build.gradle")) { language = "java"; serviceType = "backend"; }

  // Skip folders with no detectable language
  if (!language) return null;

  // Default service type
  if (!serviceType) serviceType = "backend";

  const service = { type: serviceType, language, folder };
  if (framework) service.framework = framework;
  if (database) service.database = database;
  if (port) service.port = port;

  return service;
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

function extractPorts(content) {
  const matches = content.match(/(?:PORT|port|listen)\s*[=:]\s*(\d{2,5})/g) || [];
  return matches
    .map((m) => parseInt(m.match(/\d{2,5}/)?.[0]))
    .filter((p) => p >= 80 && p <= 65535);
}

function extractEnvVars(content) {
  const matches = content.match(/process\.env\.([A-Z_]+)|os\.environ\.get\(['"]([A-Z_]+)['"]\)/g) || [];
  return matches.map((m) => m.replace(/process\.env\.|os\.environ\.get\(['"]|['"]\)/g, ""));
}

function buildSummary(services) {
  const types = services.map((s) => s.framework || s.language || s.type).join(", ");
  const dbs = services.filter((s) => s.database).map((s) => s.database).join(", ");
  return `Detected: ${types || "unknown"}${dbs ? ` | Databases: ${dbs}` : ""}`;
}

module.exports = { detectServices };
