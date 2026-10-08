import React from "react";
import styles from "./phaseSystem.module.css";

// The three parts of a group's final marks, in the order they're marked.
export const STAGE_ORDER = ["INTERNAL", "SUPERVISOR", "EXTERNAL"];
export const STAGE_LABELS = { GENERAL: "General", INTERNAL: "Internal", SUPERVISOR: "Supervisor", EXTERNAL: "External" };

const STAGE_BADGE = { INTERNAL: "badgeBlue", SUPERVISOR: "badgeGreen", EXTERNAL: "badgeYellow" };

export const StageBadge = ({ stage }) => {
  if (!stage || stage === "GENERAL") return null;
  return <span className={`${styles.badge} ${styles[STAGE_BADGE[stage]]}`}>{STAGE_LABELS[stage]}</span>;
};

export const formatStageScore = (stage) => {
  if (!stage || stage.status === "NOT_SCHEDULED") return "—";
  return `${stage.obtained ?? "—"} / ${stage.max}`;
};

const stageStatusText = (stage) => {
  if (stage.status === "COMPLETED") return "Completed";
  if (stage.status === "PENDING") return "Pending";
  return "Not scheduled";
};

// Internal → Supervisor → External → Total strip for one group. `summary` is
// one entry from the /stage-marks endpoints; scores may be null when the
// viewer isn't allowed to see them, in which case only the status shows.
export const StageTracker = ({ summary }) => {
  if (!summary) return null;
  return (
    <div className={styles.stageRow}>
      {STAGE_ORDER.map((key, i) => {
        const stage = summary.stages[key];
        const done = stage.status === "COMPLETED";
        return (
          <div key={key} className={`${styles.stageCell} ${done ? styles.stageDone : ""}`}>
            <span className={styles.stageLabel}>{i + 1}. {STAGE_LABELS[key]}</span>
            <strong>{done && stage.obtained !== null ? `${stage.obtained} / ${stage.max}` : stage.max ? `— / ${stage.max}` : "—"}</strong>
            <span className={styles.stageStatus}>{stageStatusText(stage)}</span>
          </div>
        );
      })}
      <div className={`${styles.stageCell} ${styles.stageTotal}`}>
        <span className={styles.stageLabel}>Total</span>
        <strong>{summary.total.obtained !== null ? `${summary.total.obtained} / ${summary.total.max}` : `— / ${summary.total.max}`}</strong>
        <span className={styles.stageStatus}>{summary.total.complete ? "Final" : "In progress"}</span>
      </div>
    </div>
  );
};
