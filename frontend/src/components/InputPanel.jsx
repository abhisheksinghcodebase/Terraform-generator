import { useState } from "react";
import styles from "./InputPanel.module.css";

export default function InputPanel({ onAnalyze, loading }) {
  const [mode, setMode] = useState("url");           // url | zip
  const [format, setFormat] = useState("terraform"); // terraform | cloudformation
  const [repoUrl, setRepoUrl] = useState("");
  const [zipFile, setZipFile] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (mode === "url" && repoUrl.trim()) {
      onAnalyze({ repoUrl: repoUrl.trim(), format });
    } else if (mode === "zip" && zipFile) {
      onAnalyze({ zipFile, format });
    }
  }

  return (
    <div className={styles.panel}>
      {/* ── Problem statement banner ── */}
      <div className={styles.problemBanner}>
        <span className={styles.problemIcon}>⚡</span>
        <p>
          Writing Terraform or CloudFormation by hand is slow and error-prone.
          Paste your GitHub repo URL or upload a ZIP — we scan your code and generate
          production-ready infrastructure scripts automatically.
        </p>
      </div>

      <h2 className={styles.title}>Analyze Your Codebase</h2>
      <p className={styles.subtitle}>Detects frameworks, databases, and ports — then generates IaC with AI</p>

      {/* ── Input mode tabs ── */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={mode === "url" ? styles.tabActive : styles.tab}
          onClick={() => setMode("url")}
        >
          GitHub URL
        </button>
        <button
          type="button"
          className={mode === "zip" ? styles.tabActive : styles.tab}
          onClick={() => setMode("zip")}
        >
          Upload ZIP
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {mode === "url" ? (
          <input
            type="text"
            placeholder="https://github.com/username/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className={styles.input}
            disabled={loading}
          />
        ) : (
          <label className={styles.fileLabel}>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => setZipFile(e.target.files[0])}
              className={styles.fileInput}
              disabled={loading}
            />
            <span className={styles.fileName}>
              {zipFile ? zipFile.name : "Choose a ZIP file..."}
            </span>
          </label>
        )}

        {/* ── Output format toggle ── */}
        <div className={styles.formatRow}>
          <span className={styles.formatLabel}>Output format</span>
          <div className={styles.formatToggle}>
            <button
              type="button"
              className={format === "terraform" ? styles.fmtActive : styles.fmt}
              onClick={() => setFormat("terraform")}
            >
              🏗 Terraform
            </button>
            <button
              type="button"
              className={format === "cloudformation" ? styles.fmtActive : styles.fmt}
              onClick={() => setFormat("cloudformation")}
            >
              ☁️ CloudFormation
            </button>
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? "Analyzing..." : "Analyze & Generate"}
        </button>
      </form>
    </div>
  );
}
