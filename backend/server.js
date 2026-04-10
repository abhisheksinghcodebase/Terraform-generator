require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");

const analyzeRouter  = require("./controllers/analyzeController");
const generateRouter = require("./controllers/generateController");
const readmeRouter   = require("./controllers/readmeController");

const app = express();
const PORT = process.env.PORT || 5000;

fs.ensureDirSync(path.join(__dirname, "uploads"));

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/analyze",  analyzeRouter);
app.use("/generate", generateRouter);
app.use("/readme",   readmeRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/", (_req, res) => res.json({
  name: "Code-to-Cloud API",
  status: "running",
  endpoints: {
    "POST /analyze":  "Analyze a GitHub repo URL or ZIP upload",
    "POST /generate": "Generate Terraform / CloudFormation from analysis JSON",
    "POST /readme":   "Generate deployment README",
    "GET  /health":   "Health check",
  },
}));

// ── Debug: test README generation ────────────────────────────
app.post("/debug/test-readme", async (_req, res) => {
  try {
    const { generateReadme } = require("./services/llmService");
    const result = await generateReadme(
      { format: "terraform", cloud: "aws", hasDocker: false, summary: "Express backend + PostgreSQL on AWS" },
      { services: [{ type: "backend", language: "nodejs", framework: "express", database: "postgresql" }], envVars: ["DATABASE_URL", "PORT"], summary: "Express + PostgreSQL" }
    );
    res.json({ ok: true, chars: result.readme?.length, preview: result.readme?.slice(0, 400) });
  } catch (err) {
    console.error("README test error:", err.stack || err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Debug: test LLM connection ────────────────────────────────
app.post("/debug/test-llm", async (_req, res) => {
  try {
    const { generateTerraform } = require("./services/llmService");
    const result = await generateTerraform({
      services: [{ type: "backend", language: "nodejs", framework: "express", port: 3000 }],
      envVars: [],
      summary: "Test: Express backend",
    });
    res.json({ ok: true, result });
  } catch (err) {
    console.error("LLM test error:", err.stack || err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
