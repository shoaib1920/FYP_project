import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaTrophy, FaRedo } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const PhaseResults = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [retryTarget, setRetryTarget] = useState(null);
  const [retryDate, setRetryDate] = useState("");
  const [retryTime, setRetryTime] = useState("");
  const [retryRoom, setRetryRoom] = useState("");

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/auth/phase-results`, authHeader());
      setSchedules(res.data.schedules || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load results" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResults(); }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const grouped = schedules.reduce((acc, s) => {
    const key = s.teamId?._id || "unknown";
    if (!acc[key]) acc[key] = { team: s.teamId, items: [] };
    acc[key].items.push(s);
    return acc;
  }, {});

  const submitRetry = async () => {
    if (!retryDate) return;
    try {
      await axios.post(
        `${API_URL}/auth/admin/phase-schedules/${retryTarget._id}/retry`,
        { scheduledDate: retryDate, scheduledTime: retryTime, room: retryRoom },
        authHeader()
      );
      setMessage({ type: "success", text: "Retry scheduled" });
      setRetryTarget(null);
      setRetryDate(""); setRetryTime(""); setRetryRoom("");
      fetchResults();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to schedule retry" });
    }
  };

  if (loading) return <div className={styles.container}><Loader text="Loading results..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaTrophy /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Phase Results</h1>
          <p className={styles.heroSub}>Pass/Fail results for completed evaluations</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      {Object.keys(grouped).length === 0 ? (
        <div className={styles.emptyBox}>No completed evaluations yet.</div>
      ) : (
        Object.values(grouped).map(({ team, items }) => (
          <div key={team?._id} className={styles.card}>
            <h3 className={styles.cardTitle}>{team?.subject} <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 13 }}>({items.length} phase{items.length !== 1 ? "s" : ""})</span></h3>
            {items.map((s) => (
              <div key={s._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid #f3f4f6" }}>
                <div>
                  <strong>{s.phaseId?.name}</strong> — Attempt #{s.attemptNumber}
                  <div style={{ fontSize: 12.5, color: "#6b7280" }}>
                    Evaluated on {new Date(s.updatedAt).toLocaleDateString()} · Average: {s.averageMarks}%
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`${styles.badge} ${s.result === "PASS" ? styles.badgeGreen : styles.badgeRed}`}>
                    {s.result === "PASS" ? "Pass" : "Fail"}
                  </span>
                  {s.result === "FAIL" && (
                    <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setRetryTarget(s)}>
                      <FaRedo /> Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {retryTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className={styles.card} style={{ width: 380 }}>
            <h3 className={styles.cardTitle}>Schedule Retry — {retryTarget.phaseId?.name}</h3>
            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label>Date</label>
              <input type="date" value={retryDate} onChange={(e) => setRetryDate(e.target.value)} />
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label>Time</label>
              <input type="time" value={retryTime} onChange={(e) => setRetryTime(e.target.value)} />
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 14 }}>
              <label>Room (optional)</label>
              <input value={retryRoom} onChange={(e) => setRetryRoom(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={submitRetry}>Schedule Retry</button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setRetryTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhaseResults;
