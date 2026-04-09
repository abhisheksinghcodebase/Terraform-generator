import React, { useState } from "react";
import InputPanel from "./components/InputPanel";
import AnalysisResult from "./components/AnalysisResult";
import TerraformOutput from "./components/TerraformOutput";
import { analyzeRepo, generateTerraform } from "./api/client";
import styles from "./App.module.css";

export default function App() {
  const [step, setStep] = useState("input"); // input | analyzing | analyzed | generating | done | error
  const [analysis, setAnalysis] = useState(null);
  const [terraform, setTerraform] = useState(null);
  const [error, setError] = useState("");

  async function handleAnalyze(payload) {
    setError("");
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
      const result = await generateTerraform(analysis);
      setTerraform(result);
      setStep("done");
    } catch (e) {
      setError(e.message);
      setStep("error");
    }
  }

  function handleReset() {
    setStep("input");
    setAnalysis(null);
    setTerraform(null);
    setError("");
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>☁️</span>
          <span>Code<span className={styles.accent}>-to-</span>Cloud</span>
        </div>
        <p className={styles.tagline}>AI-powered Terraform generator from your codebase</p>
      </header>

      <main className={styles.main}>
        {(step === "input" || step === "analyzing") && (
          <InputPanel onAnalyze={handleAnalyze} loading={step === "analyzing"} />
        )}

        {(step === "analyzed" || step === "generating") && analysis && (
          <AnalysisResult
            analysis={analysis}
            onGenerate={handleGenerate}
            onReset={handleReset}
            loading={step === "generating"}
          />
        )}

        {step === "done" && terraform && (
          <TerraformOutput terraform={terraform} analysis={analysis} onReset={handleReset} />
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
