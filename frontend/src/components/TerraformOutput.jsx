import React, { useState } from "react";
import styles from "./TerraformOutput.module.css";

const TABS = [
  { key: "mainTf", label: "main.tf" },
  { key: "variablesTf", label: "variables.tf" },
  { key: "outputsTf", label: "outputs.tf" },
];

export default function TerraformOutput({ terraform, analysis, onReset }) {
  const [activeTab, setActiveTab] = useState("mainTf");
  const [copied, setCopied] = useState(false);

  const currentContent = terraform[activeTab] || "";

  function handleCopy() {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadAll() {
    const files = {
      "main.tf": terraform.mainTf,
      "variables.tf": terraform.variablesTf,
      "outputs.tf": terraform.outputsTf,
    };
    Object.entries(files).forEach(([name, content]) => {
      if (!content) return;
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleDownloadCurrent() {
    const name = TABS.find((t) => t.key === activeTab)?.label || "terraform.tf";
    const blob = new Blob([currentContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.topBar}>
        <div>
          <h2 className={styles.title}>Terraform Generated</h2>
          {terraform.summary && <p className={styles.summary}>{terraform.summary}</p>}
        </div>
        <div className={styles.topActions}>
          {terraform.confidence > 0 && (
            <div className={styles.confidence}>
              <span className={styles.confLabel}>Confidence</span>
              <span className={styles.confValue}>{terraform.confidence}%</span>
            </div>
          )}
          <button className={styles.resetBtn} onClick={onReset}>← Start Over</button>
        </div>
      </div>

      <div className={styles.outputPanel}>
        <div className={styles.panelHeader}>
          <div className={styles.fileTabs}>
            {TABS.map((t) => (
              <button
                key={t.key}
                className={activeTab === t.key ? styles.fileTabActive : styles.fileTab}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className={styles.actions}>
            <button className={styles.actionBtn} onClick={handleCopy}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <button className={styles.actionBtn} onClick={handleDownloadCurrent}>
              ↓ This file
            </button>
            <button className={styles.actionBtnPrimary} onClick={handleDownloadAll}>
              ↓ Download All
            </button>
          </div>
        </div>

        <pre className={styles.codeBlock}>
          <code>{currentContent || "# No content generated for this file"}</code>
        </pre>
      </div>
    </div>
  );
}
