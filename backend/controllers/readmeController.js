const express = require("express");
const router = express.Router();
const { generateReadme } = require("../services/llmService");

// POST /readme
// Body: { iacResult: {...}, analysisResult: {...} }
router.post("/", async (req, res) => {
  try {
    const { iacResult, analysisResult } = req.body;
    if (!iacResult || !analysisResult) {
      return res.status(400).json({ error: "Provide both iacResult and analysisResult" });
    }
    console.log(`[README] Generating for cloud=${iacResult.cloud} format=${iacResult.format}`);
    const result = await generateReadme(iacResult, analysisResult);
    if (!result.readme) {
      console.error("[README] LLM returned empty readme field");
      return res.status(500).json({ error: "LLM returned empty README — try again" });
    }
    console.log(`[README] Generated ${result.readme.length} chars`);
    res.json(result);
  } catch (err) {
    console.error("README error:", err.stack || err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
