import { useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import styles from "./ReadmePanel.module.css";
import { generateReadme } from "../api/client";

export default function ReadmePanel({ iac, analysis }) {
  const [readme,    setReadme]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [generated, setGenerated] = useState(false);
  const [copied,    setCopied]    = useState(false);

  const handleEditorChange = useCallback((val) => setReadme(val || ""), []);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const result = await generateReadme(iac, analysis);
      setReadme(result.readme || "");
      setGenerated(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(readme);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!readme) return;
    const blob = new Blob([readme], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "README.md"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.panel}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.icon}>📄</span>
          <div>
            <h3 className={styles.title}>Deployment README</h3>
            <p className={styles.subtitle}>
              Auto-generated guide: prerequisites, deploy steps, access URL, cost estimate & cleanup
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {generated && (
            <>
              <button className={styles.actionBtn} onClick={handleCopy}>
                {copied ? "✓ Copied" : "⎘ Copy"}
              </button>
              <button className={styles.actionBtnPrimary} onClick={handleDownload}>
                ↓ README.md
              </button>
            </>
          )}
          <button
            className={generated ? styles.regenBtn : styles.generateBtn}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? "⏳ Generating..." : generated ? "↺ Regenerate" : "✨ Generate README"}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {/* ── Steps preview (always visible) ── */}
      {!generated && !loading && (
        <div className={styles.preview}>
          <p className={styles.previewTitle}>Will include:</p>
          <div className={styles.steps}>
            {[
              "📦 Architecture overview — all resources provisioned",
              "🔧 Prerequisites — tools + install links",
              "⚙️  Configuration — variables table with defaults",
              "🚀 Deploy steps — terraform init → plan → apply",
              "🌐 Access your app — how to get the public URL",
              "💰 Estimated cost — monthly cloud spend",
              "🧹 Cleanup — terraform destroy",
            ].map((s, i) => (
              <div key={i} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Monaco editor for the README ── */}
      {generated && (
        <div className={styles.editorWrap}>
          <div className={styles.editorTitleBar}>
            <div className={styles.trafficLights}>
              <span className={styles.tlRed}   />
              <span className={styles.tlYellow}/>
              <span className={styles.tlGreen} />
            </div>
            <span className={styles.fileName}>README.md</span>
          </div>
          <Editor
            height="480px"
            language="markdown"
            value={readme}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineNumbers: "on",
              minimap: { enabled: false },
              wordWrap: "on",
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
            }}
          />
          <div className={styles.statusBar}>
            <span>MARKDOWN</span>
            <span>README.md</span>
            <span className={styles.statusRight}>UTF-8</span>
          </div>
        </div>
      )}
    </div>
  );
}
