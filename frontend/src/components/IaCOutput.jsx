import { useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import styles from "./IaCOutput.module.css";
import ReadmePanel from "./ReadmePanel";
import DeployGuide from "./DeployGuide";

const TERRAFORM_TABS = [
  { key: "mainTf",      label: "main.tf",       lang: "hcl"  },
  { key: "variablesTf", label: "variables.tf",  lang: "hcl"  },
  { key: "outputsTf",   label: "outputs.tf",    lang: "hcl"  },
];

// Tab config for every native IaC format
const FORMAT_TABS = {
  terraform:           TERRAFORM_TABS,
  cloudformation:      [{ key: "templateYaml", label: "template.yaml",    lang: "yaml" }],
  arm:                 [{ key: "templateJson", label: "azuredeploy.json",  lang: "json" }],
  deploymentmanager:   [{ key: "templateYaml", label: "deployment.yaml",  lang: "yaml" }],
  doappspec:           [{ key: "templateYaml", label: "app.yaml",         lang: "yaml" }],
  ociresourcemanager:  [{ key: "templateTf",   label: "stack.tf",         lang: "hcl"  }],
};

const FORMAT_LABELS = {
  terraform:          { icon: "🏗",  label: "Terraform" },
  cloudformation:     { icon: "☁️", label: "CloudFormation" },
  arm:                { icon: "🔷", label: "ARM Template" },
  deploymentmanager:  { icon: "⚙️", label: "Deployment Manager" },
  doappspec:          { icon: "🌊", label: "App Spec" },
  ociresourcemanager: { icon: "🔶", label: "Resource Manager" },
};

const DOCKER_COMPUTE = {
  aws:          "ECS Fargate + ECR",
  azure:        "ACI + ACR",
  gcp:          "Cloud Run + Artifact Registry",
  digitalocean: "App Platform",
  oracle:       "OCI Container Instances",
};

export default function IaCOutput({ iac, analysis, onReset }) {
  const TABS = FORMAT_TABS[iac.format] || TERRAFORM_TABS;
  const meta = FORMAT_LABELS[iac.format] || FORMAT_LABELS.terraform;

  const [activeTab, setActiveTab]   = useState(TABS[0].key);
  const [copied, setCopied]         = useState(false);
  const [saved, setSaved]           = useState(false);
  // editable copies of each file
  const [files, setFiles] = useState({
    mainTf:       iac.mainTf       || "",
    variablesTf:  iac.variablesTf  || "",
    outputsTf:    iac.outputsTf    || "",
    templateYaml: iac.templateYaml || "",
  });

  const currentTab     = TABS.find((t) => t.key === activeTab);
  const currentContent = files[activeTab] || "";
  const isDirty        = currentContent !== (iac[activeTab] || "");

  const handleEditorChange = useCallback((value) => {
    setFiles((prev) => ({ ...prev, [activeTab]: value || "" }));
  }, [activeTab]);

  function handleCopy() {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSave() {
    // "Save" just confirms the edit — content is already in state
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setFiles((prev) => ({ ...prev, [activeTab]: iac[activeTab] || "" }));
  }

  function download(name, content) {
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadCurrent() {
    download(currentTab.label, currentContent);
  }

  function handleDownloadAll() {
    if (iac.format === "terraform") {
      download("main.tf",      files.mainTf);
      download("variables.tf", files.variablesTf);
      download("outputs.tf",   files.outputsTf);
    } else {
      // single-file formats
      const tab = TABS[0];
      download(tab.label, files[tab.key] || "");
    }
  }

  const formatLabel = meta.label;
  const formatIcon  = meta.icon;

  return (
    <div className={styles.wrapper}>

      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div>
          <h2 className={styles.title}>{formatIcon} {formatLabel} Generated</h2>
          {iac.summary && <p className={styles.summary}>{iac.summary}</p>}
        </div>
        <div className={styles.topActions}>
          {iac.confidence > 0 && (
            <div className={styles.confidence}>
              <span className={styles.confLabel}>Confidence</span>
              <span className={styles.confValue}>{iac.confidence}%</span>
            </div>
          )}
          <button className={styles.resetBtn} onClick={onReset}>← Start Over</button>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className={styles.solveBanner}>
        <span>✅</span>
        <span>
          Generated from your codebase — edit directly below, then download.
          {iac.hasDocker && (
            <> &nbsp;<strong>🐳 Docker detected</strong> — using {DOCKER_COMPUTE[iac.cloud] || "container-based"} compute.</>
          )}
        </span>
      </div>

      {/* ── Editor panel ── */}
      <div className={styles.editorPanel}>

        {/* Title bar — macOS style */}
        <div className={styles.editorTitleBar}>
          <div className={styles.trafficLights}>
            <span className={styles.tlRed}   />
            <span className={styles.tlYellow}/>
            <span className={styles.tlGreen} />
          </div>

          {/* File tabs */}
          <div className={styles.fileTabs}>
            {TABS.map((t) => (
              <button
                key={t.key}
                className={activeTab === t.key ? styles.fileTabActive : styles.fileTab}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
                {files[t.key] !== (iac[t.key] || "") && (
                  <span className={styles.dirtyDot} title="Unsaved changes" />
                )}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className={styles.actions}>
            {isDirty && (
              <button className={styles.revertBtn} onClick={handleReset} title="Revert to generated">
                ↺ Revert
              </button>
            )}
            <button className={styles.actionBtn} onClick={handleSave}>
              {saved ? "✓ Saved" : "💾 Save"}
            </button>
            <button className={styles.actionBtn} onClick={handleCopy}>
              {copied ? "✓ Copied" : "⎘ Copy"}
            </button>
            <button className={styles.actionBtn} onClick={handleDownloadCurrent}>
              ↓ This file
            </button>
            <button className={styles.actionBtnPrimary} onClick={handleDownloadAll}>
              ↓ Download All
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <Editor
          key={activeTab}
          height="520px"
          language={currentTab.lang}
          value={currentContent}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            lineNumbers: "on",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            wordWrap: "off",
            tabSize: 2,
            renderWhitespace: "selection",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            padding: { top: 16, bottom: 16 },
          }}
        />

        {/* Status bar */}
        <div className={styles.statusBar}>
          <span className={styles.statusLang}>{currentTab.lang.toUpperCase()}</span>
          <span className={styles.statusFile}>{currentTab.label}</span>
          {isDirty
            ? <span className={styles.statusDirty}>● Unsaved changes</span>
            : <span className={styles.statusClean}>✓ No changes</span>
          }
          <span className={styles.statusRight}>Spaces: 2 · UTF-8</span>
        </div>
      </div>

      {/* ── Deployment Guide ── */}
      <DeployGuide iac={iac} />

      {/* ── README Generator ── */}
      <ReadmePanel iac={iac} analysis={analysis} />

    </div>
  );
}
