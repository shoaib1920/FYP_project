import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../shared/phaseSystem.module.css";
import Loader from "../Loader";
import { FaCalendarCheck } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const StudentMeetings = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await axios.get(`${API_URL}/auth/student/my-attendance`, authHeader());
        setAttendance(res.data.attendance || []);
      } catch (err) {
        setMessage({ type: "error", text: "Failed to load meetings" });
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, []);

  const statusBadge = (status) => {
    if (status === "PRESENT") return <span className={`${styles.badge} ${styles.badgeGreen}`}>Present</span>;
    if (status === "LATE") return <span className={`${styles.badge} ${styles.badgeYellow}`}>Late</span>;
    if (status === "ABSENT") return <span className={`${styles.badge} ${styles.badgeRed}`}>Absent</span>;
    return <span className={`${styles.badge} ${styles.badgeGray}`}>Not marked yet</span>;
  };

  if (loading) return <div className={styles.container}><Loader text="Loading..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaCalendarCheck /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>My Meetings</h1>
          <p className={styles.heroSub}>Meetings scheduled by your supervisor & your attendance record</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Meeting Schedule</h3>
        {attendance.length === 0 ? (
          <div className={styles.emptyBox}>No meetings scheduled yet.</div>
        ) : (
          attendance.map((m) => (
            <div key={m.meetingId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid #f3f4f6" }}>
              <div>
                <strong>{new Date(m.scheduledAt).toLocaleDateString()}</strong>
                {m.agenda && <div style={{ fontSize: 12.5, color: "#6b7280" }}>{m.agenda}</div>}
              </div>
              {statusBadge(m.status)}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudentMeetings;
