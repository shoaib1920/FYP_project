import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaClipboardCheck } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const PhaseEvaluation = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [marksForm, setMarksForm] = useState({}); // scheduleId -> {studentId: marks}
  const [saving, setSaving] = useState(null);
  const [filter, setFilter] = useState("ALL");

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/auth/faculty/phase-schedules`, authHeader());
      setSchedules(res.data.schedules || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load evaluations" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSchedules(); }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const grouped = schedules.reduce((acc, s) => {
    const key = s.teamId?._id || "unknown";
    if (!acc[key]) acc[key] = { team: s.teamId, items: [] };
    acc[key].items.push(s);
    return acc;
  }, {});

  const counts = {
    ALL: schedules.length,
    ACTION: schedules.filter((s) => s.status === "SCHEDULED").length,
    COMPLETED: schedules.filter((s) => s.status === "COMPLETED").length,
  };

  const filterGroups = (items) => {
    if (filter === "ACTION") return items.filter((s) => s.status === "SCHEDULED");
    if (filter === "COMPLETED") return items.filter((s) => s.status === "COMPLETED");
    return items;
  };

  const setMark = (scheduleId, studentId, value) => {
    setMarksForm((prev) => ({ ...prev, [scheduleId]: { ...prev[scheduleId], [studentId]: value } }));
  };

  const submitMarks = async (schedule) => {
    const entries = marksForm[schedule._id] || {};
    const marks = Object.entries(entries)
      .filter(([, v]) => v !== "" && v !== undefined)
      .map(([studentId, marksObtained]) => ({ studentId, marksObtained: Number(marksObtained) }));
    if (marks.length === 0) return;

    try {
      setSaving(schedule._id);
      await axios.post(`${API_URL}/auth/faculty/phase-marks`, { phaseScheduleId: schedule._id, marks }, authHeader());
      setMessage({ type: "success", text: "Marks submitted successfully!" });
      fetchSchedules();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to submit marks" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className={styles.container}><Loader text="Loading evaluations..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaClipboardCheck /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Phase Evaluation</h1>
          <p className={styles.heroSub}>Submit marks for your assigned students</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.chipRow} style={{ marginBottom: 18 }}>
        <span className={`${styles.chip} ${filter === "ALL" ? styles.chipActive : ""}`} onClick={() => setFilter("ALL")}>All ({counts.ALL})</span>
        <span className={`${styles.chip} ${filter === "ACTION" ? styles.chipActive : ""}`} onClick={() => setFilter("ACTION")}>🟢 Action Needed ({counts.ACTION})</span>
        <span className={`${styles.chip} ${filter === "COMPLETED" ? styles.chipActive : ""}`} onClick={() => setFilter("COMPLETED")}>✅ Completed ({counts.COMPLETED})</span>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className={styles.emptyBox}>No evaluations assigned to you yet.</div>
      ) : (
        Object.values(grouped).map(({ team, items }) => {
          const visibleItems = filterGroups(items);
          if (visibleItems.length === 0) return null;
          return (
            <div key={team?._id} className={styles.groupItem}>
              <div className={styles.groupHeader} onClick={() => setExpandedTeam(expandedTeam === team?._id ? null : team?._id)}>
                <strong>{team?.subject}</strong>
                <span style={{ color: "#9ca3af", fontSize: 13 }}>{items.length} phase{items.length !== 1 ? "s" : ""}</span>
              </div>
              {expandedTeam === team?._id && (
                <div className={styles.groupBody}>
                  {visibleItems.map((s) => (
                    <div key={s._id} style={{ marginBottom: 18, paddingBottom: 16, borderBottom: "1px solid #f3f4f6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <strong>{s.phaseId?.name} <span style={{ fontWeight: 400, color: "#9ca3af" }}>Total: {s.phaseId?.totalMarks} marks</span></strong>
                        <span className={`${styles.badge} ${s.status === "COMPLETED" ? styles.badgeGray : styles.badgeBlue}`}>
                          {s.status === "COMPLETED" ? "✅ Completed" : "SCHEDULED"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 10 }}>
                        {new Date(s.scheduledDate).toLocaleDateString()} {s.scheduledTime}
                      </div>

                      {s.status === "COMPLETED" ? (
                        <div style={{ color: "#059669", fontSize: 13, fontWeight: 600 }}>
                          ✅ Evaluation completed — Result: {s.result} ({s.averageMarks}%)
                        </div>
                      ) : (
                        <>
                          {(team?.members || []).map((student) => (
                            <div key={student._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                              <span>{student.name}</span>
                              <input
                                type="number"
                                min="0"
                                max={s.phaseId?.totalMarks}
                                placeholder={`/ ${s.phaseId?.totalMarks}`}
                                style={{ width: 90, padding: 7, borderRadius: 8, border: "1.5px solid #e5e7eb" }}
                                value={marksForm[s._id]?.[student._id] ?? ""}
                                onChange={(e) => setMark(s._id, student._id, e.target.value)}
                              />
                            </div>
                          ))}
                          <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            style={{ marginTop: 10 }}
                            disabled={saving === s._id}
                            onClick={() => submitMarks(s)}
                          >
                            {saving === s._id ? "Submitting..." : "Submit Marks"}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default PhaseEvaluation;
