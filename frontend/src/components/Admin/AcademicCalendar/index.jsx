import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import {
  FaCalendarAlt,
  FaPlus,
  FaCheckCircle,
  FaClock,
  FaTrash,
  FaEdit,
} from "react-icons/fa";

const emptyForm = { name: "", proposalDeadline: "", finalSubmissionDeadline: "" };

const formatDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const daysUntil = (d) => {
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const AcademicCalendar = () => {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const apiBase = process.env.REACT_APP_API_URL || "";
  const token = localStorage.getItem("adminToken");
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const fetchTerms = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/auth/admin/academic-terms`, authHeader);
      setTerms(res.data.terms || []);
    } catch (err) {
      console.error("Error fetching academic terms:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTerm = useMemo(() => terms.find((t) => t.isActive) || null, [terms]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (term) => {
    setEditingId(term._id);
    setForm({
      name: term.name,
      proposalDeadline: new Date(term.proposalDeadline).toISOString().slice(0, 10),
      finalSubmissionDeadline: new Date(term.finalSubmissionDeadline).toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.proposalDeadline || !form.finalSubmissionDeadline) {
      alert("Please fill in all fields.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await axios.put(`${apiBase}/auth/admin/academic-terms/${editingId}`, form, authHeader);
        showToast("Term updated successfully.");
      } else {
        await axios.post(`${apiBase}/auth/admin/academic-terms`, form, authHeader);
        showToast("Term created successfully.");
      }
      setModalOpen(false);
      fetchTerms();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save term.");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (term) => {
    try {
      await axios.put(`${apiBase}/auth/admin/academic-terms/${term._id}/activate`, {}, authHeader);
      showToast(`"${term.name}" is now the active term.`);
      fetchTerms();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to activate term.");
    }
  };

  const handleDelete = async (term) => {
    if (!window.confirm(`Delete "${term.name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${apiBase}/auth/admin/academic-terms/${term._id}`, authHeader);
      showToast("Term deleted.");
      fetchTerms();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete term.");
    }
  };

  const noData = !loading && terms.length === 0;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaCalendarAlt /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Academic Calendar</h2>
          <p className={styles.subheading}>Set proposal and final-submission deadlines for the current term.</p>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {!loading && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#dbeafe", color: "#1e40af" }}>
              <FaCalendarAlt />
            </div>
            <div>
              <h4>Total Terms</h4>
              <p>{terms.length}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#dcfce7", color: "#15803d" }}>
              <FaCheckCircle />
            </div>
            <div>
              <h4>Active Term</h4>
              <p className={styles.statTextSm}>{activeTerm ? activeTerm.name : "None set"}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#fef3c7", color: "#92400e" }}>
              <FaClock />
            </div>
            <div>
              <h4>Proposal Deadline</h4>
              <p className={styles.statTextSm}>
                {activeTerm ? `${formatDate(activeTerm.proposalDeadline)} (${daysUntil(activeTerm.proposalDeadline)}d)` : "—"}
              </p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#fee2e2", color: "#b91c1c" }}>
              <FaClock />
            </div>
            <div>
              <h4>Final Submission Deadline</h4>
              <p className={styles.statTextSm}>
                {activeTerm ? `${formatDate(activeTerm.finalSubmissionDeadline)} (${daysUntil(activeTerm.finalSubmissionDeadline)}d)` : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={styles.actionsRow}>
        <button type="button" className={styles.createBtn} onClick={openCreateModal}>
          <FaPlus /> New Term
        </button>
      </div>

      {loading ? (
        <p className={styles.emptyMsg}>Loading terms...</p>
      ) : noData ? (
        <div className={styles.noResultsBox}>
          <div className={styles.emptyIconWrap}><FaCalendarAlt /></div>
          <h4>No academic terms yet</h4>
          <p>Create one to start enforcing proposal and final-submission deadlines.</p>
        </div>
      ) : (
        <div className={styles.termGrid}>
          {terms.map((term) => {
            const proposalDays = daysUntil(term.proposalDeadline);
            const finalDays = daysUntil(term.finalSubmissionDeadline);
            return (
              <div key={term._id} className={`${styles.termCard} ${term.isActive ? styles.termCardActive : ""}`}>
                <div className={styles.termCardHeader}>
                  <h3 className={styles.termName}>{term.name}</h3>
                  {term.isActive && <span className={styles.activeBadge}><FaCheckCircle /> Active</span>}
                </div>

                <div className={styles.deadlineRow}>
                  <span className={styles.deadlineLabel}>Proposal Deadline</span>
                  <span className={proposalDays < 0 ? styles.deadlinePassed : styles.deadlineValue}>
                    {formatDate(term.proposalDeadline)} {proposalDays >= 0 ? `(${proposalDays}d left)` : "(passed)"}
                  </span>
                </div>
                <div className={styles.deadlineRow}>
                  <span className={styles.deadlineLabel}>Final Submission</span>
                  <span className={finalDays < 0 ? styles.deadlinePassed : styles.deadlineValue}>
                    {formatDate(term.finalSubmissionDeadline)} {finalDays >= 0 ? `(${finalDays}d left)` : "(passed)"}
                  </span>
                </div>

                <div className={styles.termActions}>
                  {!term.isActive && (
                    <button type="button" className={styles.activateBtn} onClick={() => handleActivate(term)}>
                      Set Active
                    </button>
                  )}
                  <button type="button" className={styles.editBtn} onClick={() => openEditModal(term)}>
                    <FaEdit /> Edit
                  </button>
                  <button type="button" className={styles.deleteBtn} onClick={() => handleDelete(term)}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className={styles.backdrop} onClick={() => setModalOpen(false)}>
          <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            <h3 className={styles.modalTitle}>{editingId ? "Edit Term" : "New Academic Term"}</h3>

            <label className={styles.label}>Term Name</label>
            <input
              type="text"
              placeholder="e.g. Fall 2026"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={styles.input}
              required
            />

            <label className={styles.label}>Proposal Submission Deadline</label>
            <input
              type="date"
              value={form.proposalDeadline}
              onChange={(e) => setForm({ ...form, proposalDeadline: e.target.value })}
              className={styles.input}
              required
            />

            <label className={styles.label}>Final Submission Deadline</label>
            <input
              type="date"
              value={form.finalSubmissionDeadline}
              onChange={(e) => setForm({ ...form, finalSubmissionDeadline: e.target.value })}
              className={styles.input}
              required
            />

            <div className={styles.modalActions}>
              <button type="submit" className={styles.saveBtn} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Term"}
              </button>
              <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendar;
