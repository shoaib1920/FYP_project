import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaGavel } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const MyPanel = () => {
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem("supervisorData"));
      setMyId(data?.id || data?._id);
    } catch {}
    const fetchPanels = async () => {
      try {
        const res = await axios.get(`${API_URL}/auth/faculty/my-panels`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setPanels(res.data.panels || []);
      } catch (err) {
        // silent — empty state covers it
      } finally {
        setLoading(false);
      }
    };
    fetchPanels();
  }, []);

  if (loading) return <div className={styles.container}><Loader text="Loading..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaGavel /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>My Panel</h1>
          <p className={styles.heroSub}>Evaluation panels you are assigned to</p>
        </div>
      </div>

      {panels.length === 0 ? (
        <div className={styles.emptyBox}>You are not assigned to any evaluation panel yet.</div>
      ) : (
        panels.map((p) => (
          <div key={p._id} className={styles.card}>
            <h3 className={styles.cardTitle}>
              {p.name} <span className={`${styles.badge} ${p.isActive ? styles.badgeGreen : styles.badgeGray}`}>{p.isActive ? "Active" : "Inactive"}</span>
            </h3>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>
              Panel Members ({p.members.length})
            </div>
            {p.members.map((m) => (
              <div key={m._id} style={{ padding: "6px 0" }}>
                {m.name} {String(m._id) === String(myId) && <span className={`${styles.badge} ${styles.badgeBlue}`}>You</span>}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export default MyPanel;
