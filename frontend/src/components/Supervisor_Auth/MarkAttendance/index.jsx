import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaCheckSquare } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;
const STATUS_OPTIONS = ["PRESENT", "LATE", "ABSENT"];

const MarkAttendance = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [records, setRecords] = useState({}); // studentId -> status
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
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
  useEffect(() => { fetchMeetings(selectedProjectId); setActiveMeeting(null); /* eslint-disable-next-line */ }, [selectedProjectId]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const openMeeting = (meeting) => {
    setActiveMeeting(meeting);
    const initial = {};
    (meeting.attendees || []).forEach((a) => {
      const existing = (meeting.attendanceRecords || []).find((r) => String(r.student) === String(a._id));
      initial[a._id] = existing ? existing.status : "PRESENT";
    });
    setRecords(initial);
  };

  const submitAttendance = async () => {
    try {
      setSaving(true);
      const payload = { records: Object.entries(records).map(([studentId, status]) => ({ studentId, status })) };
      await axios.put(`${API_URL}/auth/faculty/meetings/${activeMeeting._id}/attendance`, payload, authHeader());
      setMessage({ type: "success", text: "Attendance saved" });
      fetchMeetings(selectedProjectId);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to save attendance" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.container}><Loader text="Loading..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaCheckSquare /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Mark Attendance</h1>
          <p className={styles.heroSub}>Mark and review attendance for your supervised groups</p>
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
            <h3 className={styles.cardTitle}>Meetings</h3>
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
                    {(m.attendanceRecords || []).length > 0 && <span className={`${styles.badge} ${styles.badgeGreen}`}>Marked</span>}
                    <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => openMeeting(m)}>Mark / View Attendance</button>
                  </div>
                </div>
              ))
            )}

            {activeMeeting && (
              <div style={{ marginTop: 18, paddingTop: 18, borderTop: "2px solid #eef2ff" }}>
                <h3 className={styles.cardTitle}>Mark Attendance — {new Date(activeMeeting.scheduledAt).toLocaleDateString()}</h3>
                {(activeMeeting.attendees || []).map((student) => (
                  <div key={student._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                    <span>{student.name}</span>
                    <div className={styles.chipRow}>
                      {STATUS_OPTIONS.map((opt) => (
                        <span
                          key={opt}
                          className={`${styles.chip} ${records[student._id] === opt ? styles.chipActive : ""}`}
                          onClick={() => setRecords({ ...records, [student._id]: opt })}
                        >
                          {opt.charAt(0) + opt.slice(1).toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {(activeMeeting.attendees || []).length === 0 && (
                  <div className={styles.emptyBox}>No attendees recorded for this meeting.</div>
                )}
                <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 12 }} disabled={saving} onClick={submitAttendance}>
                  {saving ? "Saving..." : "Save Attendance"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MarkAttendance;
