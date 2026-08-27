import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaLayerGroup, FaPlus, FaTrash, FaEdit } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const emptyForm = {
  name: "", description: "", totalMarks: "", convertToMarks: "",
  panelId: "", requiresUpload: false, criteria: [],
};

const PhaseManagement = () => {
  const [phases, setPhases] = useState([]);
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [phasesRes, panelsRes] = await Promise.all([
        axios.get(`${API_URL}/auth/phases`, authHeader()),
        axios.get(`${API_URL}/auth/panels`, authHeader()),
      ]);
      setPhases(phasesRes.data.phases || []);
      setPanels(panelsRes.data.panels || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load phases" });
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

  const addCriterion = () => setForm((f) => ({ ...f, criteria: [...f.criteria, { name: "", maxMarks: "" }] }));
  const updateCriterion = (i, field, value) =>
    setForm((f) => ({ ...f, criteria: f.criteria.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)) }));
  const removeCriterion = (i) => setForm((f) => ({ ...f, criteria: f.criteria.filter((_, idx) => idx !== i) }));

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.totalMarks || !form.convertToMarks) return;
    const payload = {
      ...form,
      totalMarks: Number(form.totalMarks),
      convertToMarks: Number(form.convertToMarks),
      panelId: form.panelId || null,
      criteria: form.criteria
        .filter((c) => c.name)
        .map((c) => ({ name: c.name, maxMarks: Number(c.maxMarks) || 0 })),
    };
    try {
      setSaving(true);
      if (editingId) {
        await axios.put(`${API_URL}/auth/admin/phases/${editingId}`, payload, authHeader());
        setMessage({ type: "success", text: "Phase updated" });
      } else {
        await axios.post(`${API_URL}/auth/admin/phases`, payload, authHeader());
        setMessage({ type: "success", text: "Phase created" });
      }
      resetForm();
      fetchAll();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to save phase" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (phase) => {
    setEditingId(phase._id);
    setForm({
      name: phase.name,
      description: phase.description || "",
      totalMarks: phase.totalMarks,
      convertToMarks: phase.convertToMarks,
      panelId: phase.panelId?._id || "",
      requiresUpload: phase.requiresUpload,
      criteria: phase.criteria || [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this phase? Existing schedules for it will remain but can no longer be re-created.")) return;
    try {
      await axios.delete(`${API_URL}/auth/admin/phases/${id}`, authHeader());
      setMessage({ type: "success", text: "Phase deleted" });
      fetchAll();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete phase" });
    }
  };

  if (loading) return <div className={styles.container}><Loader text="Loading phases..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaLayerGroup /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Manage Phases</h1>
          <p className={styles.heroSub}>Create and manage FYP evaluation phases</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}><FaPlus /> {editingId ? "Edit Phase" : "Add New Phase"}</h3>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Phase Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className={styles.formGroup}>
              <label>Total Marks</label>
              <input type="number" min="0" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} required />
            </div>
            <div className={styles.formGroup}>
              <label>Convert To</label>
              <input type="number" min="0" value={form.convertToMarks} onChange={(e) => setForm({ ...form, convertToMarks: e.target.value })} required />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Evaluation Panel (optional)</label>
              <select value={form.panelId} onChange={(e) => setForm({ ...form, panelId: e.target.value })}>
                <option value="">-- No Panel --</option>
                {panels.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Description (optional)</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 14 }}>
            <label>Break Marks into Criteria (optional)</label>
            {form.criteria.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input placeholder="Criterion name" value={c.name} onChange={(e) => updateCriterion(i, "name", e.target.value)} style={{ flex: 2, padding: 8, borderRadius: 8, border: "1.5px solid #e5e7eb" }} />
                <input placeholder="Max marks" type="number" value={c.maxMarks} onChange={(e) => updateCriterion(i, "maxMarks", e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: "1.5px solid #e5e7eb" }} />
                <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => removeCriterion(i)}><FaTrash /></button>
              </div>
            ))}
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={addCriterion}><FaPlus /> Add Criterion</button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13.5, fontWeight: 600, color: "#374151" }}>
            <input type="checkbox" checked={form.requiresUpload} onChange={(e) => setForm({ ...form, requiresUpload: e.target.checked })} />
            Requires Document / Code Upload
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving} type="submit">
              {saving ? "Saving..." : editingId ? "Update Phase" : "Add Phase"}
            </button>
            {editingId && <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Existing Phases ({phases.length})</h3>
        {phases.length === 0 ? (
          <div className={styles.emptyBox}>No phases created yet.</div>
        ) : (
          phases.map((p) => (
            <div key={p._id} className={styles.groupItem}>
              <div className={styles.groupHeader} style={{ cursor: "default" }}>
                <div>
                  <strong>{p.name}</strong>
                  {p.requiresUpload && <span className={`${styles.badge} ${styles.badgeBlue}`} style={{ marginLeft: 8 }}>Upload Required</span>}
                  {p.panelId && <span style={{ marginLeft: 8, fontSize: 12, color: "#6b7280" }}>Panel: {p.panelId.name}</span>}
                  <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 4 }}>
                    Total: {p.totalMarks} &nbsp;→&nbsp; Converts to: {p.convertToMarks}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => handleEdit(p)}><FaEdit /> Edit</button>
                  <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(p._id)}><FaTrash /> Delete</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PhaseManagement;
