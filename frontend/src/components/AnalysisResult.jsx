import styles from "./AnalysisResult.module.css";

const SERVICE_ICONS = {
  backend: "⚙️",
  frontend: "🖥️",
  database: "🗄️",
};

const DB_ICONS = {
  mongodb: "🍃",
  postgresql: "🐘",
  mysql: "🐬",
  redis: "🔴",
};

export default function AnalysisResult({ analysis, format, onGenerate, onReset, loading }) {
  const { services = [], summary, envVars = [] } = analysis;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Analysis Complete</h2>
          <p className={styles.summary}>{summary}</p>
        </div>
        <button className={styles.resetBtn} onClick={onReset}>← Start Over</button>
      </div>

      <div className={styles.grid}>
        {services.map((svc, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.icon}>{SERVICE_ICONS[svc.type] || "📦"}</span>
              <span className={styles.serviceType}>{svc.type}</span>
            </div>
            <div className={styles.details}>
              {svc.language && <Tag label="Language" value={svc.language} />}
              {svc.framework && <Tag label="Framework" value={svc.framework} color="accent" />}
              {svc.database && (
                <Tag label="Database" value={`${DB_ICONS[svc.database] || ""} ${svc.database}`} color="green" />
              )}
              {svc.port && <Tag label="Port" value={svc.port} />}
              {svc.folder && svc.folder !== "." && <Tag label="Folder" value={svc.folder} />}
            </div>
          </div>
        ))}
      </div>

      {envVars.length > 0 && (
        <div className={styles.envSection}>
          <h3 className={styles.envTitle}>Detected Env Variables</h3>
          <div className={styles.envList}>
            {envVars.slice(0, 12).map((v) => (
              <code key={v} className={styles.envVar}>{v}</code>
            ))}
          </div>
        </div>
      )}

      <button className={styles.generateBtn} onClick={onGenerate} disabled={loading}>
        {loading
          ? `Generating ${format === "cloudformation" ? "CloudFormation" : "Terraform"} — may take up to 60s...`
          : `Generate ${format === "cloudformation" ? "☁️ CloudFormation" : "🏗 Terraform"} →`}
      </button>
    </div>
  );
}

function Tag({ label, value, color }) {
  return (
    <div className={styles.tag}>
      <span className={styles.tagLabel}>{label}</span>
      <span className={`${styles.tagValue} ${color ? styles[color] : ""}`}>{value}</span>
    </div>
  );
}
