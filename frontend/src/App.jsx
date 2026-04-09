import { useState } from "react";
import InputPanel from "./components/InputPanel";
import AnalysisResult from "./components/AnalysisResult";
import IaCOutput from "./components/IaCOutput";
import TerminalLog from "./components/TerminalLog";
import { analyzeRepo, generateIaC } from "./api/client";
import styles from "./App.module.css";

// Helper to build a terminal line object
function line(text, type = "info") {
  return { text, type };
}

export default function App() {
  const [step, setStep] = useState("input"); // input | analyzing | analyzed | generating | done | error
  const [analysis, setAnalysis] = useState(null);
  const [iac, setIaC] = useState(null);
  const [format, setFormat] = useState("terraform");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);

  function addLog(text, type = "info") {
    setLogs((prev) => [...prev, line(text, type)]);
  }

  async function handleAnalyze(payload) {
    setError("");
    setFormat(payload.format || "terraform");
    setLogs([]);
    setStep("analyzing");

    addLog("[SYSTEM] Initiating scan sequence...", "system");

    if (payload.repoUrl) {
      addLog(`[NETWORK] Fetching from ${payload.repoUrl}...`, "network");
    } else {
      addLog("[SYSTEM] Reading uploaded ZIP archive...", "system");
    }

    try {
      const result = await analyzeRepo(payload);
      addLog("[SUCCESS] Repository fetched successfully.", "success");
      addLog(`[SYSTEM] Detected ${result.services?.length || 0} service(s).`, "system");
      result.services?.forEach((s) => {
        addLog(
          `[INFO] Service: ${s.framework || s.language} (${s.type})${s.database ? ` + ${s.database}` : ""}`,
          "info"
        );
      });
      if (result.envVars?.length) {
        addLog(`[INFO] Found ${result.envVars.length} environment variable(s).`, "info");
      }
      addLog("[SUCCESS] Analysis complete. Ready to generate IaC.", "success");
      setAnalysis(result);
      setStep("analyzed");
    } catch (e) {
      addLog(`[ERROR] ${e.message}`, "error");
      setError(e.message);
      setStep("error");
    }
  }

  async function handleGenerate() {
    setError("");
    setStep("generating");
    const fmt = format === "cloudformation" ? "CloudFormation" : "Terraform";

    addLog(`[SYSTEM] Starting ${fmt} generation...`, "system");
    addLog("[LLM] Sending analysis to AI model...", "llm");
    addLog("[LLM] Generating infrastructure code — this may take a moment...", "llm");

    try {
      const result = await generateIaC(analysis, format);
      addLog(`[SUCCESS] ${fmt} files generated successfully.`, "success");
      addLog(`[INFO] Confidence score: ${result.confidence}%`, "info");
      setIaC(result);
      setStep("done");
    } catch (e) {
      addLog(`[ERROR] ${e.message}`, "error");
      setError(e.message);
      setStep("error");
    }
  }

  function handleReset() {
    setStep("input");
    setAnalysis(null);
    setIaC(null);
    setError("");
    setLogs([]);
  }

  const showTerminal = logs.length > 0 && step !== "done";

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>☁️</span>
          <span>Code<span className={styles.accent}>-to-</span>Cloud</span>
        </div>
        <p className={styles.tagline}>AI-powered IaC generator — scan your repo, get Terraform or CloudFormation instantly</p>
      </header>

      <main className={styles.main}>
        {(step === "input" || step === "analyzing") && (
          <InputPanel onAnalyze={handleAnalyze} loading={step === "analyzing"} />
        )}

        {showTerminal && <TerminalLog lines={logs} />}

        {(step === "analyzed" || step === "generating") && analysis && (
          <AnalysisResult
            analysis={analysis}
            format={format}
            onGenerate={handleGenerate}
            onReset={handleReset}
            loading={step === "generating"}
          />
        )}

        {step === "done" && iac && (
          <IaCOutput iac={iac} onReset={handleReset} />
        )}

        {step === "error" && (
          <div className={styles.errorBox}>
            <span>⚠️ {error}</span>
            <button className={styles.resetBtn} onClick={handleReset}>Try Again</button>
          </div>
        )}
      </main>
    </div>
  );
}
