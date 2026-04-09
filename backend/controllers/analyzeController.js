const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { analyzeFromZip, analyzeFromGitHub } = require("../services/analyzerService");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/zip" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files are allowed"));
    }
  },
});

// POST /analyze  — accepts either { repoUrl } or a ZIP file upload
router.post("/", upload.single("zipFile"), async (req, res) => {
  try {
    let result;

    if (req.file) {
      // ZIP upload path
      result = await analyzeFromZip(req.file.path);
    } else if (req.body.repoUrl) {
      // GitHub URL path
      result = await analyzeFromGitHub(req.body.repoUrl);
    } else {
      return res.status(400).json({ error: "Provide a repoUrl or upload a ZIP file" });
    }

    res.json(result);
  } catch (err) {
    console.error("Analyze error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
