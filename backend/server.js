require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");

const analyzeRouter = require("./controllers/analyzeController");
const generateRouter = require("./controllers/generateController");

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
fs.ensureDirSync(path.join(__dirname, "uploads"));

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/analyze", analyzeRouter);
app.use("/generate", generateRouter);

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Root — friendly message instead of "Cannot GET /"
app.get("/", (req, res) => {
  res.json({
    name: "Code-to-Cloud API",
    status: "running",
    endpoints: {
      "POST /analyze": "Analyze a GitHub repo URL or ZIP upload",
      "POST /generate": "Generate Terraform or CloudFormation from analysis JSON",
      "GET  /health":   "Health check",
    },
  });
});

// Debug: test DeepSeek connection with a minimal payload
app.post("/debug/test-llm", async (req, res) => {
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
