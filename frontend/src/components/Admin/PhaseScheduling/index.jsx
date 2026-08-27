import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaCalendarAlt, FaPlus, FaTrash } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const PhaseScheduling = () => {
  const [phases, setPhases] = useState([]);
  const [teams, setTeams] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [form, setForm] = useState({ phaseId: "", teamId: "", teamIds: [], scheduledDate: "", scheduledTime: "", room: "" });

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [phasesRes, teamsRes, schedulesRes] = await Promise.all([
        axios.get(`${API_URL}/auth/phases`, authHeader()),
        axios.get(`${API_URL}/auth/teams`, authHeader()),
        axios.get(`${API_URL}/auth/admin/phase-schedules`, authHeader()),
      ]);
      setPhases(phasesRes.data.phases || []);
      setTeams(teamsRes.data.teams || []);
      setSchedules(schedulesRes.data.schedules || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load scheduling data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const toggleBulkTeam = (id) => {
    setForm((f) => ({
      ...f,
      teamIds: f.teamIds.includes(id) ? f.teamIds.filter((t) => t !== id) : [...f.teamIds, id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.phaseId || !form.scheduledDate) return;
    if (bulkMode && form.teamIds.length === 0) return;
    if (!bulkMode && !form.teamId) return;

    try {
      setSaving(true);
      await axios.post(
        `${API_URL}/auth/admin/phase-schedules`,
        {
          phaseId: form.phaseId,
          teamId: bulkMode ? undefined : form.teamId,
          teamIds: bulkMode ? form.teamIds : undefined,
          scheduledDate: form.scheduledDate,
          scheduledTime: form.scheduledTime,
          room: form.room,
        },
        authHeader()
      );
      setMessage({ type: "success", text: "Schedule created" });
      setForm({ phaseId: "", teamId: "", teamIds: [], scheduledDate: "", scheduledTime: "", room: "" });
      fetchAll();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to create schedule" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this schedule?")) return;
    try {
      await axios.delete(`${API_URL}/auth/admin/phase-schedules/${id}`, authHeader());
      fetchAll();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete schedule" });
    }
  };

  const resultBadge = (result) => {
    if (result === "PASS") return <span className={`${styles.badge} ${styles.badgeGreen}`}>Pass</span>;
    if (result === "FAIL") return <span className={`${styles.badge} ${styles.badgeRed}`}>Fail</span>;
    return null;
  };
  const statusBadge = (status) => {
    if (status === "COMPLETED") return <span className={`${styles.badge} ${styles.badgeGray}`}>Completed</span>;
    if (status === "CANCELLED") return <span className={`${styles.badge} ${styles.badgeRed}`}>Cancelled</span>;
    return <span className={`${styles.badge} ${styles.badgeBlue}`}>Scheduled</span>;
  };

  if (loading) return <div className={styles.container}><Loader text="Loading schedules..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaCalendarAlt /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Phase Schedules</h1>
          <p className={styles.heroSub}>Assign evaluation schedules to groups</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <FaPlus /> {bulkMode ? "Bulk Assign Phase to Multiple Groups" : "Add Schedule"}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            style={{ marginLeft: "auto" }}
            onClick={() => setBulkMode((b) => !b)}
          >
            Switch to {bulkMode ? "Single" : "Bulk"} Assign
          </button>
        </h3>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Select Phase</label>
              <select value={form.phaseId} onChange={(e) => setForm({ ...form, phaseId: e.target.value })} required>
                <option value="">-- Select Phase --</option>
                {phases.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            {!bulkMode && (
              <div className={styles.formGroup}>
                <label>Select Group</label>
                <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })} required>
                  <option value="">-- Select Group --</option>
                  {teams.map((t) => <option key={t._id} value={t._id}>{t.subject}</option>)}
                </select>
              </div>
            )}
            <div className={styles.formGroup}>
              <label>Schedule Date</label>
              <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} required />
            </div>
            <div className={styles.formGroup}>
              <label>Schedule Time</label>
              <input type="time" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label>Room (optional)</label>
              <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </div>
          </div>

          {bulkMode && (
            <div className={styles.formGroup} style={{ marginBottom: 14 }}>
              <label>Select Groups</label>
              <div className={styles.chipRow}>
                {teams.map((t) => (
                  <span key={t._id} className={`${styles.chip} ${form.teamIds.includes(t._id) ? styles.chipActive : ""}`} onClick={() => toggleBulkTeam(t._id)}>
                    {t.subject}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving} type="submit">
            {saving ? "Saving..." : "Add Schedule"}
          </button>
        </form>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Existing Schedules ({schedules.length})</h3>
        {schedules.length === 0 ? (
          <div className={styles.emptyBox}>No schedules yet.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Phase</th><th>Group</th><th>Date</th><th>Time</th><th>Room</th><th>Status</th><th>Result</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s._id}>
                    <td>{s.phaseId?.name}</td>
                    <td>{s.teamId?.subject}{s.attemptNumber > 1 ? ` (Attempt #${s.attemptNumber})` : ""}</td>
                    <td>{new Date(s.scheduledDate).toLocaleDateString()}</td>
                    <td>{s.scheduledTime || "—"}</td>
                    <td>{s.room || "—"}</td>
                    <td>{statusBadge(s.status)}</td>
                    <td>{resultBadge(s.result)}</td>
                    <td>
                      <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(s._id)}><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhaseScheduling;
