import { useEffect, useRef } from "react";
import styles from "./TerminalLog.module.css";

export default function TerminalLog({ lines }) {
  const bottomRef = useRef(null);

  // Auto-scroll to latest line
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className={styles.terminal}>
      <div className={styles.titleBar}>
        <span className={styles.titleText}>Terminal Output</span>
        <div className={styles.dots}>
          <span className={styles.dotRed} />
          <span className={styles.dotYellow} />
          <span className={styles.dotGreen} />
        </div>
      </div>
      <div className={styles.body}>
        {lines.map((line, i) => (
          <div key={i} className={styles.line}>
            <span className={styles.prompt}>&gt;</span>
            <span className={`${styles.text} ${styles[line.type] || ""}`}>
              {line.text}
            </span>
          </div>
        ))}
        {/* blinking cursor on last line */}
        <div className={styles.line}>
          <span className={styles.prompt}>&gt;</span>
          <span className={styles.cursor}>█</span>
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
