import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaGavel, FaPlus, FaTrash, FaToggleOn, FaToggleOff } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const EvaluationPanels = () => {
  const [panels, setPanels] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null); // { type, text }
  const [form, setForm] = useState({ name: "", description: "", members: [] });
  const [saving, setSaving] = useState(false);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [panelsRes, supsRes] = await Promise.all([
        axios.get(`${API_URL}/auth/panels`, authHeader()),
        axios.get(`${API_URL}/auth/admin/supervisors`, authHeader()),
      ]);
      setPanels(panelsRes.data.panels || []);
      setSupervisors(supsRes.data.supervisors || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load panels" });
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

  const toggleMember = (id) => {
    setForm((prev) => ({
      ...prev,
      members: prev.members.includes(id) ? prev.members.filter((m) => m !== id) : [...prev.members, id],
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      setSaving(true);
      await axios.post(`${API_URL}/auth/admin/panels`, form, authHeader());
      setForm({ name: "", description: "", members: [] });
      setMessage({ type: "success", text: "Panel created" });
      fetchAll();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to create panel" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (panel) => {
    try {
      await axios.put(`${API_URL}/auth/admin/panels/${panel._id}`, { isActive: !panel.isActive }, authHeader());
      fetchAll();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to update panel" });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this panel?")) return;
    try {
      await axios.delete(`${API_URL}/auth/admin/panels/${id}`, authHeader());
      setMessage({ type: "success", text: "Panel deleted" });
      fetchAll();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete panel" });
    }
  };

  if (loading) return <div className={styles.container}><Loader text="Loading panels..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaGavel /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Evaluation Panels</h1>
          <p className={styles.heroSub}>Create groups of faculty evaluators to assign against evaluation phases</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}><FaPlus /> Create New Panel</h3>
        <form onSubmit={handleCreate}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Panel Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className={styles.formGroup}>
              <label>Description (optional)</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className={styles.formGroup} style={{ marginBottom: 14 }}>
            <label>Select Faculty Members</label>
            <div className={styles.chipRow}>
              {supervisors.map((s) => (
                <span
                  key={s._id}
                  className={`${styles.chip} ${form.members.includes(s._id) ? styles.chipActive : ""}`}
                  onClick={() => toggleMember(s._id)}
                >
                  {s.name}
                </span>
              ))}
              {supervisors.length === 0 && <span style={{ color: "#9ca3af", fontSize: 13 }}>No faculty registered yet</span>}
            </div>
          </div>
          <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving} type="submit">
            <FaPlus /> {saving ? "Creating..." : "Create Panel"}
          </button>
        </form>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Existing Panels ({panels.length})</h3>
        {panels.length === 0 ? (
          <div className={styles.emptyBox}>No panels created yet.</div>
        ) : (
          panels.map((p) => (
            <div key={p._id} className={styles.groupItem}>
              <div className={styles.groupHeader}>
                <div>
                  <strong>{p.name}</strong>{" "}
                  <span className={`${styles.badge} ${p.isActive ? styles.badgeGreen : styles.badgeGray}`}>
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                  <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 4 }}>
                    {p.members.map((m) => m.name).join(", ") || "No members"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => toggleActive(p)}>
                    {p.isActive ? <FaToggleOn /> : <FaToggleOff />} {p.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(p._id)}>
                    <FaTrash /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EvaluationPanels;
