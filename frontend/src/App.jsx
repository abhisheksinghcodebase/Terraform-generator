import { useState, useRef, useEffect } from "react";
import InputPanel from "./components/InputPanel";
import AnalysisResult from "./components/AnalysisResult";
import IaCOutput from "./components/IaCOutput";
import TerminalLog from "./components/TerminalLog";
import { analyzeRepo, generateIaC } from "./api/client";
import styles from "./App.module.css";

const LINE_DELAY = 180;

const STEPS = [
  { id: "input",     label: "Input" },
  { id: "analyzing", label: "Analyze" },
  { id: "analyzed",  label: "Review" },
  { id: "generating",label: "Generate" },
  { id: "done",      label: "Output" },
];

function getStepIndex(step) {
  const map = { input: 0, analyzing: 1, analyzed: 2, generating: 3, done: 4, error: 0 };
  return map[step] ?? 0;
}

export default function App() {
  const [step, setStep]         = useState("input");
  const [analysis, setAnalysis] = useState(null);
  const [iac, setIaC]           = useState(null);
  const [format, setFormat]     = useState("terraform");
  const [cloud, setCloud]       = useState("aws");
  const [error, setError]       = useState("");
  const [logs, setLogs]         = useState([]);
  const [theme, setTheme]       = useState(() =>
    localStorage.getItem("theme") || "dark"
  );

  const queue    = useRef([]);
  const dripping = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function queueLog(text, type = "info") {
    queue.current.push({ text, type });
    if (!dripping.current) drip();
  }

  function drip() {
    if (queue.current.length === 0) { dripping.current = false; return; }
    dripping.current = true;
    const next = queue.current.shift();
    setLogs((prev) => [...prev, next]);
    setTimeout(drip, LINE_DELAY);
  }

  function waitForDrip() {
    return new Promise((resolve) => {
      const check = () => {
        if (!dripping.current && queue.current.length === 0) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  async function handleAnalyze(payload) {
    setError("");
    setFormat(payload.format || "terraform");
    setCloud(payload.cloud || "aws");
    setLogs([]);
    queue.current    = [];
    dripping.current = false;
    setStep("analyzing");

    queueLog("[SYSTEM] Initiating scan sequence...", "system");
    queueLog("[SYSTEM] Loading detection engine...", "system");
    queueLog(`[SYSTEM] Target cloud: ${(payload.cloud || "aws").toUpperCase()}`, "system");

    if (payload.repoUrl) {
      queueLog(`[NETWORK] Fetching from ${payload.repoUrl}...`, "network");
      queueLog("[NETWORK] Resolving default branch...", "network");
      queueLog("[NETWORK] Downloading file tree...", "network");
    } else {
      queueLog("[SYSTEM] Reading uploaded ZIP archive...", "system");
      queueLog("[SYSTEM] Extracting contents...", "system");
    }

    try {
      const result = await analyzeRepo(payload);
      queueLog("[SUCCESS] Repository fetched successfully.", "success");
      queueLog(`[SYSTEM] Scanning ${result.detectedFiles?.length || 0} file(s)...`, "system");
      queueLog(`[SYSTEM] Detected ${result.services?.length || 0} service(s).`, "system");
      if (result.hasDocker) queueLog("[SYSTEM] 🐳 Dockerfile detected — container infra will be generated.", "success");
      result.services?.forEach((s) =>
        queueLog(`[INFO] Service: ${s.framework || s.language} (${s.type})${s.database ? ` + ${s.database}` : ""}`, "info")
      );
      if (result.envVars?.length) queueLog(`[INFO] Found ${result.envVars.length} environment variable(s).`, "info");
      queueLog("[SUCCESS] Analysis complete. Ready to generate IaC.", "success");
      await waitForDrip();
      setAnalysis(result);
      setStep("analyzed");
    } catch (e) {
      queueLog(`[ERROR] ${e.message}`, "error");
      await waitForDrip();
      setError(e.message);
      setStep("error");
    }
  }

  async function handleGenerate() {
    setError("");
    setStep("generating");
    const fmt = format === "cloudformation" ? "CloudFormation" : "Terraform";
    queueLog(`[SYSTEM] Starting ${fmt} generation for ${cloud.toUpperCase()}...`, "system");
    queueLog("[LLM] Connecting to AI model...", "llm");
    queueLog("[LLM] Sending project analysis payload...", "llm");
    queueLog("[LLM] Generating infrastructure code — please wait...", "llm");

    try {
      const result = await generateIaC(analysis, format, cloud);
      queueLog("[LLM] Response received. Parsing output...", "llm");
      if (format === "terraform") {
        queueLog("[INFO] Writing main.tf...", "info");
        queueLog("[INFO] Writing variables.tf...", "info");
        queueLog("[INFO] Writing outputs.tf...", "info");
      } else {
        queueLog("[INFO] Writing template file...", "info");
      }
      queueLog(`[SUCCESS] ${fmt} files generated successfully.`, "success");
      queueLog(`[INFO] Confidence score: ${result.confidence}%`, "info");
      await waitForDrip();
      setIaC(result);
      setStep("done");
    } catch (e) {
      queueLog(`[ERROR] ${e.message}`, "error");
      await waitForDrip();
      setError(e.message);
      setStep("error");
    }
  }

  function handleReset() {
    setStep("input");
    setAnalysis(null);
    setIaC(null);
    setError("");
    setCloud("aws");
    setLogs([]);
    queue.current    = [];
    dripping.current = false;
  }

  const currentStepIdx = getStepIndex(step);
  const showTerminal   = logs.length > 0 && step !== "done";

  return (
    <div className={styles.app}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>☁️</div>
            <div className={styles.logoText}>
              Code<span className={styles.accent}>2</span>Cloud
            </div>
          </div>
          <span className={styles.badge}>AI-Powered</span>
          <p className={styles.tagline}>Scan your repo → get production-ready IaC instantly</p>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.themeBtn}
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* ── Step indicator ── */}
      {step !== "error" && (
        <div className={styles.stepBar} role="progressbar" aria-label="Progress">
          {STEPS.map((s, i) => {
            const isDone   = i < currentStepIdx;
            const isActive = i === currentStepIdx;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                <div className={`${styles.stepItem} ${isActive ? styles.active : ""} ${isDone ? styles.done : ""}`}>
                  <div className={styles.stepDot}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className={styles.stepLabel}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`${styles.stepLine} ${isDone ? styles.done : ""}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Main content ── */}
      <main className={styles.main}>
        {(step === "input" || step === "analyzing") && (
          <div className="fadeUp">
            <InputPanel onAnalyze={handleAnalyze} loading={step === "analyzing"} />
          </div>
        )}

        {showTerminal && (
          <div className="fadeUp">
            <TerminalLog lines={logs} />
          </div>
        )}

        {(step === "analyzed" || step === "generating") && analysis && (
          <div className="fadeUp">
            <AnalysisResult
              analysis={analysis}
              format={format}
              cloud={cloud}
              onGenerate={handleGenerate}
              onReset={handleReset}
              loading={step === "generating"}
            />
          </div>
        )}

        {step === "done" && iac && (
          <div className="fadeUp">
            <IaCOutput iac={iac} analysis={analysis} onReset={handleReset} />
          </div>
        )}

        {step === "error" && (
          <div className={`${styles.errorBox} fadeUp`}>
            <span>⚠️ {error}</span>
            <button className={styles.resetBtn} onClick={handleReset}>Try Again</button>
          </div>
        )}
      </main>
    </div>
  );
}
