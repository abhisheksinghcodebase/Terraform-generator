const express = require("express");
const router = express.Router();
const { generateTerraform } = require("../services/llmService");

// POST /generate — accepts structured JSON from /analyze
router.post("/", async (req, res) => {
  try {
    const analysisResult = req.body;

    if (!analysisResult || !analysisResult.services) {
      return res.status(400).json({ error: "Invalid analysis payload. Expected { services: [...] }" });
    }

    const terraform = await generateTerraform(analysisResult);
    res.json(terraform);
  } catch (err) {
    console.error("Generate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
