import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaCalendarAlt, FaPlus, FaTrash, FaToggleOn, FaToggleOff } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const AcademicSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/auth/sessions`, authHeader());
      setSessions(res.data.sessions || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load sessions" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      await axios.post(`${API_URL}/auth/admin/sessions`, { name }, authHeader());
      setName("");
      setMessage({ type: "success", text: "Session added successfully." });
      fetchSessions();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to add session" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (session) => {
    try {
      await axios.put(`${API_URL}/auth/admin/sessions/${session._id}`, { isActive: !session.isActive }, authHeader());
      fetchSessions();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to update session" });
    }
  };

  const handleDelete = async (session) => {
    if (!window.confirm(`Delete session "${session.name}"?`)) return;
    try {
      await axios.delete(`${API_URL}/auth/admin/sessions/${session._id}`, authHeader());
      setMessage({ type: "success", text: "Session deleted." });
      fetchSessions();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to delete session" });
    }
  };

  if (loading) return <div className={styles.container}><Loader text="Loading sessions..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaCalendarAlt /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Academic Sessions</h1>
          <p className={styles.heroSub}>Manage the session tags (e.g. "2022-2026") used across departments</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}><FaPlus /> Add Session</h3>
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="e.g. 2022-2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, padding: 10, borderRadius: 9, border: "1.5px solid #e5e7eb" }}
            required
          />
          <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving} type="submit">
            {saving ? "Adding..." : "Add"}
          </button>
        </form>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Sessions ({sessions.length})</h3>
        {sessions.length === 0 ? (
          <div className={styles.emptyBox}>No sessions added yet.</div>
        ) : (
          sessions.map((s) => (
            <div key={s._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #f3f4f6" }}>
              <div>
                <strong>{s.name}</strong>{" "}
                <span className={`${styles.badge} ${s.isActive ? styles.badgeGreen : styles.badgeGray}`}>{s.isActive ? "Active" : "Inactive"}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => toggleActive(s)}>
                  {s.isActive ? <FaToggleOn /> : <FaToggleOff />} {s.isActive ? "Deactivate" : "Activate"}
                </button>
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(s)}><FaTrash /> Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AcademicSessions;
