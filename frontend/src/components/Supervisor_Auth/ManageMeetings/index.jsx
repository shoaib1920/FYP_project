import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaCalendarPlus, FaTrash } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const ManageMeetings = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({ date: "", time: "", agenda: "" });
  const [saving, setSaving] = useState(false);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/projects/supervisor`, authHeader());
      setProjects(res.data.projects || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load groups" });
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async (projectId) => {
    if (!projectId) { setMeetings([]); return; }
    try {
      const res = await axios.get(`${API_URL}/auth/meetings/${projectId}`, authHeader());
      setMeetings(res.data.meetings || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load meetings" });
    }
  };

  useEffect(() => { fetchProjects(); }, []);
  useEffect(() => { fetchMeetings(selectedProjectId); /* eslint-disable-next-line */ }, [selectedProjectId]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!selectedProjectId || !form.date) return;
    try {
      setSaving(true);
      const scheduledAt = form.time ? `${form.date}T${form.time}` : form.date;
      await axios.post(`${API_URL}/auth/meetings`, { projectId: selectedProjectId, scheduledAt, agenda: form.agenda }, authHeader());
      setMessage({ type: "success", text: "Meeting scheduled" });
      setForm({ date: "", time: "", agenda: "" });
      fetchMeetings(selectedProjectId);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to schedule meeting" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (meetingId) => {
    if (!window.confirm("Cancel this meeting?")) return;
    try {
      await axios.put(`${API_URL}/auth/meetings/${meetingId}/status`, { status: "CANCELLED" }, authHeader());
      fetchMeetings(selectedProjectId);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to cancel meeting" });
    }
  };

  if (loading) return <div className={styles.container}><Loader text="Loading..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaCalendarPlus /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Manage Meetings</h1>
          <p className={styles.heroSub}>Schedule, edit, and cancel meetings for your supervised groups</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.card}>
        <div className={styles.formGroup} style={{ marginBottom: 16 }}>
          <label>FYP Group</label>
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
            <option value="">-- Select a group --</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.teamId?.subject} — {p.title}</option>)}
          </select>
        </div>

        {selectedProjectId && (
          <>
            <h3 className={styles.cardTitle}>Schedule New Meeting</h3>
            <form onSubmit={handleSchedule}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div className={styles.formGroup}>
                  <label>Time (optional)</label>
                  <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>Agenda (optional)</label>
                  <input value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
                </div>
              </div>
              <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving} type="submit">
                {saving ? "Scheduling..." : "Schedule Meeting"}
              </button>
            </form>

            <h3 className={styles.cardTitle} style={{ marginTop: 24 }}>Meetings</h3>
            {meetings.length === 0 ? (
              <div className={styles.emptyBox}>No meetings scheduled yet.</div>
            ) : (
              meetings.map((m) => (
                <div key={m._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #f3f4f6" }}>
                  <div>
                    <strong>{new Date(m.scheduledAt).toLocaleDateString()}</strong>
                    {m.agenda && <span style={{ marginLeft: 10, color: "#6b7280", fontSize: 13 }}>{m.agenda}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className={`${styles.badge} ${m.status === "CANCELLED" ? styles.badgeRed : styles.badgeGreen}`}>{m.status}</span>
                    {m.status !== "CANCELLED" && (
                      <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleCancel(m._id)}><FaTrash /></button>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ManageMeetings;
