import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaSearch } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const GroupTracking = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });

  useEffect(() => {
    axios.get(`${API_URL}/auth/admin/group-tracking`, authHeader())
      .then((res) => setGroups(res.data.groups || []))
      .catch(() => setMessage({ type: "error", text: "Failed to load groups" }))
      .finally(() => setLoading(false));
  }, []);

  const viewHistory = async (teamId) => {
    setHistoryFor(teamId);
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API_URL}/auth/admin/group-tracking/${teamId}`, authHeader());
      setHistory(res.data);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load group history" });
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) return <div className={styles.container}><Loader text="Loading groups..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaSearch /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Group Tracking</h1>
          <p className={styles.heroSub}>View complete FYP history of all groups</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles.error}`}>{message.text}</div>}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Total: {groups.length}</h3>
        {groups.map((g) => (
          <div key={g.teamId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid #f3f4f6" }}>
            <div>
              <strong>{g.subject}</strong>
              <div style={{ fontSize: 12.5, color: "#6b7280" }}>Supervisor: {g.supervisor} • Members: {g.members}</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className={`${styles.badge} ${g.status === "Open" ? styles.badgeGray : styles.badgeBlue}`}>{g.status}</span>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => viewHistory(g.teamId)}>View History</button>
            </div>
          </div>
        ))}
      </div>

      {historyFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className={styles.card} style={{ width: 640, maxHeight: "85vh", overflowY: "auto" }}>
            {historyLoading || !history ? <Loader text="Loading history..." /> : (
              <>
                <h3 className={styles.cardTitle}>{history.team?.subject} — Full History</h3>

                <div style={{ marginBottom: 16 }}>
                  <strong>Proposal:</strong> {history.proposal ? `${history.proposal.title} — ${history.proposal.status}` : "Not submitted"}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <strong>Project:</strong> {history.project ? `${history.project.status} (Supervisor: ${history.project.supervisorId?.name || "—"})` : "Not created yet"}
                </div>

                <strong>Phase History</strong>
                {(history.phaseHistory || []).length === 0 ? (
                  <div className={styles.emptyBox} style={{ margin: "10px 0" }}>No phases scheduled.</div>
                ) : (
                  history.phaseHistory.map((p) => (
                    <div key={p._id} style={{ padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
                      {p.phaseId?.name} — Attempt #{p.attemptNumber} —{" "}
                      {p.status === "COMPLETED" ? (
                        <span className={`${styles.badge} ${p.result === "PASS" ? styles.badgeGreen : styles.badgeRed}`}>{p.result} ({p.averageMarks}%)</span>
                      ) : <span className={`${styles.badge} ${styles.badgeBlue}`}>Scheduled</span>}
                    </div>
                  ))
                )}

                <strong style={{ display: "block", marginTop: 16 }}>Meetings ({(history.meetings || []).length})</strong>
                {(history.meetings || []).map((m) => (
                  <div key={m._id} style={{ padding: "6px 0", fontSize: 13, color: "#6b7280" }}>
                    {new Date(m.scheduledAt).toLocaleDateString()} — {m.status}
                  </div>
                ))}

                <button className={`${styles.btn} ${styles.btnSecondary}`} style={{ marginTop: 16 }} onClick={() => { setHistoryFor(null); setHistory(null); }}>Close</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupTracking;
