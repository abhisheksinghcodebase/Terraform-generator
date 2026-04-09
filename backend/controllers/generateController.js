const express = require("express");
const router = express.Router();
const { generateTerraform, generateCloudFormation } = require("../services/llmService");

// POST /generate
// Body: { services, envVars, summary, format }
// format: "terraform" (default) | "cloudformation"
router.post("/", async (req, res) => {
  try {
    const { format = "terraform", ...analysisResult } = req.body;

    if (!analysisResult || !analysisResult.services) {
      return res.status(400).json({ error: "Invalid payload. Expected { services: [...] }" });
    }

    let result;
    if (format === "cloudformation") {
      result = await generateCloudFormation(analysisResult);
    } else {
      result = await generateTerraform(analysisResult);
    }

    res.json(result);
  } catch (err) {
    // Log full stack so you can see the real cause in the terminal
    console.error("Generate error:", err.stack || err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
