const express = require("express");
const router = express.Router();
const { generateTerraform, generateNativeIaC } = require("../services/llmService");

// Native IaC formats (non-Terraform) per cloud
const NATIVE_FORMATS = new Set([
  "cloudformation", // AWS
  "arm",            // Azure
  "deploymentmanager", // GCP
  "doappspec",      // DigitalOcean
  "ociresourcemanager", // Oracle
]);

// POST /generate
// Body: { services, envVars, summary, hasDocker, format, cloud }
router.post("/", async (req, res) => {
  try {
    const { format = "terraform", cloud = "aws", ...analysisResult } = req.body;

    if (!analysisResult || !analysisResult.services) {
      return res.status(400).json({ error: "Invalid payload. Expected { services: [...] }" });
    }

    const result = NATIVE_FORMATS.has(format)
      ? await generateNativeIaC(analysisResult, cloud)
      : await generateTerraform(analysisResult, cloud);

    res.json(result);
  } catch (err) {
    console.error("Generate error:", err.stack || err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
