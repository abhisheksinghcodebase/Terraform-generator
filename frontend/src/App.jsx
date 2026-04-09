import { useState } from "react";
import InputPanel from "./components/InputPanel";
import AnalysisResult from "./components/AnalysisResult";
import IaCOutput from "./components/IaCOutput";
import { analyzeRepo, generateIaC } from "./api/client";
import styles from "./App.module.css";

export default function App() {
  const [step, setStep] = useState("input"); // input | analyzing | analyzed | generating | done | error
  const [analysis, setAnalysis] = useState(null);
  const [iac, setIaC] = useState(null);
  const [format, setFormat] = useState("terraform"); // terraform | cloudformation
  const [error, setError] = useState("");

  async function handleAnalyze(payload) {
    setError("");
    setFormat(payload.format || "terraform");
    setStep("analyzing");
    try {
      const result = await analyzeRepo(payload);
      setAnalysis(result);
      setStep("analyzed");
    } catch (e) {
      setError(e.message);
      setStep("error");
    }
  }

  async function handleGenerate() {
    setError("");
    setStep("generating");
    try {
      const result = await generateIaC(analysis, format);
      setIaC(result);
      setStep("done");
    } catch (e) {
      setError(e.message);
      setStep("error");
    }
  }

  function handleReset() {
    setStep("input");
    setAnalysis(null);
    setIaC(null);
    setError("");
  }

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
        )}      </main>
    </div>
  );
}
