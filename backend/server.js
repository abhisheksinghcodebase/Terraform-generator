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

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
