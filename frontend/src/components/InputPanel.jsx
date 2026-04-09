import React, { useState } from "react";
import styles from "./InputPanel.module.css";

export default function InputPanel({ onAnalyze, loading }) {
  const [mode, setMode] = useState("url"); // url | zip
  const [repoUrl, setRepoUrl] = useState("");
  const [zipFile, setZipFile] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (mode === "url" && repoUrl.trim()) {
      onAnalyze({ repoUrl: repoUrl.trim() });
    } else if (mode === "zip" && zipFile) {
      onAnalyze({ zipFile });
    }
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Analyze Your Codebase</h2>
      <p className={styles.subtitle}>Provide a GitHub repo or upload a ZIP file</p>

      <div className={styles.tabs}>
        <button
          className={mode === "url" ? styles.tabActive : styles.tab}
          onClick={() => setMode("url")}
        >
          GitHub URL
        </button>
        <button
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

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? "Analyzing..." : "Analyze & Generate"}
        </button>
      </form>
    </div>
  );
}
