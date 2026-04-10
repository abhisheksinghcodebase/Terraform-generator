import { useState } from "react";
import styles from "./InputPanel.module.css";

const CLOUDS = [
  { id: "aws",          label: "AWS",    icon: "🟠", color: "#FF9900" },
  { id: "azure",        label: "Azure",  icon: "🔵", color: "#0078D4" },
  { id: "gcp",          label: "GCP",    icon: "🔴", color: "#4285F4" },
  { id: "digitalocean", label: "DO",     icon: "💧", color: "#0080FF" },
  { id: "oracle",       label: "Oracle", icon: "🔶", color: "#F80000" },
];

const NATIVE_FORMAT = {
  aws:          { id: "cloudformation",    label: "CloudFormation",    icon: "☁️" },
  azure:        { id: "arm",               label: "ARM Template",      icon: "🔷" },
  gcp:          { id: "deploymentmanager", label: "Deployment Mgr",    icon: "⚙️" },
  digitalocean: { id: "doappspec",         label: "App Spec",          icon: "🌊" },
  oracle:       { id: "ociresourcemanager",label: "Resource Mgr",      icon: "🔶" },
};

export default function InputPanel({ onAnalyze, loading }) {
  const [mode,    setMode]    = useState("url");
  const [cloud,   setCloud]   = useState("aws");
  const [format,  setFormat]  = useState("terraform");
  const [repoUrl, setRepoUrl] = useState("");
  const [zipFile, setZipFile] = useState(null);

  function handleCloudChange(id) {
    setCloud(id);
    setFormat("terraform");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (mode === "url" && repoUrl.trim()) onAnalyze({ repoUrl: repoUrl.trim(), format, cloud });
    else if (mode === "zip" && zipFile)   onAnalyze({ zipFile, format, cloud });
  }

  const nativeFmt  = NATIVE_FORMAT[cloud];
  const canSubmit  = mode === "url" ? repoUrl.trim().length > 0 : !!zipFile;

  return (
    <div className={styles.wrapper}>
      {/* ── Hero ── */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>From Code to Cloud Infrastructure</h1>
        <p className={styles.heroSub}>
          Paste a GitHub URL or upload a ZIP — AI scans your codebase and generates
          production-ready Terraform or native IaC in seconds.
        </p>
      </div>

      <div className={styles.card}>
        {/* ── Cloud selector ── */}
        <p className={styles.sectionLabel}>Target Cloud</p>
        <div className={styles.cloudGrid}>
          {CLOUDS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cloud === c.id ? styles.cloudBtnActive : styles.cloudBtn}
              style={cloud === c.id ? { "--cloud-color": c.color } : {}}
              onClick={() => handleCloudChange(c.id)}
              disabled={loading}
              aria-pressed={cloud === c.id}
            >
              <span className={styles.cloudIcon}>{c.icon}</span>
              <span className={styles.cloudLabel}>{c.label}</span>
            </button>
          ))}
        </div>

        {/* ── Input mode tabs ── */}
        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={mode === "url"}
            className={mode === "url" ? styles.tabActive : styles.tab}
            onClick={() => setMode("url")} disabled={loading}>
            🔗 GitHub URL
          </button>
          <button type="button" role="tab" aria-selected={mode === "zip"}
            className={mode === "zip" ? styles.tabActive : styles.tab}
            onClick={() => setMode("zip")} disabled={loading}>
            📦 Upload ZIP
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === "url" ? (
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>🔗</span>
              <input
                type="url"
                placeholder="https://github.com/username/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className={styles.input}
                disabled={loading}
                aria-label="GitHub repository URL"
              />
            </div>
          ) : (
            <label className={styles.fileLabel}>
              <input type="file" accept=".zip"
                onChange={(e) => setZipFile(e.target.files[0])}
                className={styles.fileInput} disabled={loading} />
              <span className={styles.fileIcon}>{zipFile ? "📦" : "⬆️"}</span>
              <span className={styles.fileName}>
                {zipFile ? zipFile.name : "Click to choose a ZIP file"}
              </span>
              <span className={styles.fileHint}>Max 50 MB · .zip only</span>
            </label>
          )}

          {/* ── Format toggle ── */}
          <div className={styles.formatRow}>
            <span className={styles.formatLabel}>Output format</span>
            <div className={styles.formatToggle}>
              <button type="button"
                className={format === "terraform" ? styles.fmtActive : styles.fmt}
                onClick={() => setFormat("terraform")}>
                🏗 Terraform
              </button>
              <button type="button"
                className={format === nativeFmt.id ? styles.fmtActive : styles.fmt}
                onClick={() => setFormat(nativeFmt.id)}>
                {nativeFmt.icon} {nativeFmt.label}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading || !canSubmit}>
            {loading
              ? <><span className={styles.spinner} />Analyzing repository...</>
              : "✨ Analyze & Generate IaC →"}
          </button>
        </form>
      </div>

      {/* ── Feature strip ── */}
      <div className={styles.features}>
        {["Docker-aware infra", "5 cloud providers", "AI-generated", "Editable output", "Free to use"].map((f) => (
          <div key={f} className={styles.feature}>
            <span className={styles.featureDot} />
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}
