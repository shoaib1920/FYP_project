import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../shared/phaseSystem.module.css";
import Loader from "../Loader";
import { FaChartLine } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const MyProgress = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamsRes = await axios.get(`${API_URL}/auth/my-teams`, authHeader());
        const myTeam = (teamsRes.data.teams || [])[0];
        if (!myTeam) { setLoading(false); return; }

        const res = await axios.get(`${API_URL}/auth/student/phase-schedules/${myTeam._id}`, authHeader());
        setSchedules(res.data.schedules || []);
      } catch (err) {
        setMessage({ type: "error", text: "Failed to load progress" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className={styles.container}><Loader text="Loading..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaChartLine /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>My Progress</h1>
          <p className={styles.heroSub}>Track your FYP phase attempts and results</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Evaluation Phases</h3>
        {schedules.length === 0 ? (
          <div className={styles.emptyBox}>No phases scheduled for your group yet.</div>
        ) : (
          schedules.map((s) => (
            <div key={s._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid #f3f4f6" }}>
              <div>
                <strong>{s.phaseId?.name}</strong> <span style={{ color: "#9ca3af", fontSize: 12.5 }}>(Attempt #{s.attemptNumber})</span>
                <div style={{ fontSize: 12.5, color: "#6b7280" }}>
                  {new Date(s.scheduledDate).toLocaleDateString()} {s.room && `• Room: ${s.room}`}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {s.status === "COMPLETED" ? (
                  <>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{s.averageMarks}%</div>
                    <span className={`${styles.badge} ${s.result === "PASS" ? styles.badgeGreen : styles.badgeRed}`}>
                      {s.result === "PASS" ? "✓ Pass" : "✗ Fail"}
                    </span>
                  </>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeYellow}`}>Pending</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyProgress;
