import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaEdit, FaClipboardList } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const MarksManagement = () => {
  const [phases, setPhases] = useState([]);
  const [marks, setMarks] = useState([]);
  const [stats, setStats] = useState({ total: 0, submitted: 0, adjusted: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [phaseFilter, setPhaseFilter] = useState("");
  const [editing, setEditing] = useState(null); // mark being adjusted
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });

  const fetchMarks = async () => {
    try {
      setLoading(true);
      const params = phaseFilter ? { phaseId: phaseFilter } : {};
      const [marksRes, phasesRes] = await Promise.all([
        axios.get(`${API_URL}/auth/admin/phase-marks`, { ...authHeader(), params }),
        axios.get(`${API_URL}/auth/phases`, authHeader()),
      ]);
      setMarks(marksRes.data.marks || []);
      setStats(marksRes.data.stats || { total: 0, submitted: 0, adjusted: 0 });
      setPhases(phasesRes.data.phases || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load marks" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMarks(); /* eslint-disable-next-line */ }, [phaseFilter]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const openAdjust = (mark) => {
    setEditing(mark);
    setAdjustValue(mark.marksObtained);
    setAdjustReason("");
  };

  const submitAdjust = async () => {
    try {
      await axios.put(
        `${API_URL}/auth/admin/phase-marks/${editing._id}`,
        { marksObtained: Number(adjustValue), adjustmentReason: adjustReason },
        authHeader()
      );
      setMessage({ type: "success", text: "Marks adjusted" });
      setEditing(null);
      fetchMarks();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to adjust marks" });
    }
  };

  if (loading) return <div className={styles.container}><Loader text="Loading marks..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaClipboardList /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Marks Management</h1>
          <p className={styles.heroSub}>View and adjust student marks per phase</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.statsRow}>
        <div className={styles.statCard}><strong>{stats.total}</strong><span>Total Records</span></div>
        <div className={styles.statCard}><strong>{stats.submitted}</strong><span>Submitted</span></div>
        <div className={styles.statCard}><strong>{stats.adjusted}</strong><span>Adjusted</span></div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.formGroup}>
          <label>Phase</label>
          <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
            <option value="">All Phases</option>
            {phases.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Marks List</h3>
        {marks.length === 0 ? (
          <div className={styles.emptyBox}>No marks submitted yet.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>#</th><th>Student</th><th>Phase</th><th>Evaluator</th><th>Marks</th><th>Converted</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {marks.map((m, i) => (
                  <tr key={m._id}>
                    <td>{i + 1}</td>
                    <td>{m.studentId?.name}</td>
                    <td>{m.phaseScheduleId?.phaseId?.name}</td>
                    <td>{m.evaluatorId?.name}</td>
                    <td>{m.marksObtained.toFixed(2)}</td>
                    <td>{m.convertedMarks.toFixed(2)}</td>
                    <td><span className={`${styles.badge} ${m.status === "ADJUSTED" ? styles.badgeYellow : styles.badgeGreen}`}>{m.status === "ADJUSTED" ? "Adjusted" : "Submitted"}</span></td>
                    <td><button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => openAdjust(m)}><FaEdit /> Adjust</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className={styles.card} style={{ width: 380 }}>
            <h3 className={styles.cardTitle}>Adjust Marks — {editing.studentId?.name}</h3>
            <div className={styles.formGroup} style={{ marginBottom: 12 }}>
              <label>Marks Obtained (max {editing.maxMarks})</label>
              <input type="number" max={editing.maxMarks} min="0" value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} />
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 14 }}>
              <label>Reason</label>
              <textarea rows={2} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={submitAdjust}>Save</button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarksManagement;
