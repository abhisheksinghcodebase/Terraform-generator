import styles from "./AnalysisResult.module.css";

const SERVICE_ICONS = { backend: "⚙️", frontend: "🖥️", database: "🗄️" };
const DB_ICONS = { mongodb: "🍃", postgresql: "🐘", mysql: "🐬", redis: "🔴" };

const CLOUD_META = {
  aws:          { label: "AWS",          icon: "🟠" },
  azure:        { label: "Azure",        icon: "🔵" },
  gcp:          { label: "GCP",          icon: "🔴" },
  digitalocean: { label: "DigitalOcean", icon: "💧" },
  oracle:       { label: "Oracle",       icon: "🔶" },
};

export default function AnalysisResult({ analysis, format, cloud = "aws", onGenerate, onReset, loading }) {
  const { services = [], summary, envVars = [], hasDocker, detectedFiles = [] } = analysis;
  const cloudMeta = CLOUD_META[cloud] || { label: cloud.toUpperCase(), icon: "☁️" };
  const fmtLabel  = format === "cloudformation" ? "☁️ CloudFormation" : "🏗 Terraform";
  const dbs       = services.filter((s) => s.database);

  return (
    <div className={styles.wrapper}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Analysis Complete</h2>
            <span className={styles.cloudBadge}>{cloudMeta.icon} {cloudMeta.label}</span>
            {hasDocker && <span className={styles.dockerBadge}>🐳 Docker</span>}
          </div>
          <p className={styles.summary}>{summary}</p>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.resetBtn} onClick={onReset}>← Start Over</button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statVal}>{services.length}</span>
          <span className={styles.statLabel}>Services</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>{dbs.length}</span>
          <span className={styles.statLabel}>Databases</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>{envVars.length}</span>
          <span className={styles.statLabel}>Env Vars</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>{detectedFiles.length}</span>
          <span className={styles.statLabel}>Files Scanned</span>
        </div>
      </div>

      {/* ── Services grid ── */}
      <div className={styles.grid}>
        {services.map((svc, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.icon}>{SERVICE_ICONS[svc.type] || "📦"}</span>
              <span className={styles.serviceType}>{svc.type}</span>
            </div>
            <div className={styles.details}>
              {svc.language  && <Tag label="Language"  value={svc.language} />}
              {svc.framework && <Tag label="Framework" value={svc.framework} color="accent" />}
              {svc.database  && <Tag label="Database"  value={`${DB_ICONS[svc.database] || ""} ${svc.database}`} color="green" />}
              {svc.port      && <Tag label="Port"      value={svc.port} />}
              {svc.folder && svc.folder !== "." && <Tag label="Folder" value={svc.folder} />}
            </div>
          </div>
        ))}
      </div>

      {/* ── Env vars ── */}
      {envVars.length > 0 && (
        <div className={styles.envSection}>
          <h3 className={styles.envTitle}>Detected Environment Variables</h3>
          <div className={styles.envList}>
            {envVars.slice(0, 16).map((v) => (
              <code key={v} className={styles.envVar}>{v}</code>
            ))}
          </div>
        </div>
      )}

      {/* ── Generate button ── */}
      <button className={styles.generateBtn} onClick={onGenerate} disabled={loading}>
        {loading
          ? <><span className={styles.spinner} />Generating {fmtLabel} for {cloudMeta.label}...</>
          : `Generate ${fmtLabel} for ${cloudMeta.icon} ${cloudMeta.label} →`}
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
