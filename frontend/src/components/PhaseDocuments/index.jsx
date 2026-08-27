import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../shared/phaseSystem.module.css";
import Loader from "../Loader";
import { FaFileUpload } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const PhaseDocuments = () => {
  const [teamId, setTeamId] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [uploading, setUploading] = useState(null);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const teamsRes = await axios.get(`${API_URL}/auth/my-teams`, authHeader());
      const myTeam = (teamsRes.data.teams || [])[0];
      if (!myTeam) { setLoading(false); return; }
      setTeamId(myTeam._id);

      const [schedulesRes, docsRes] = await Promise.all([
        axios.get(`${API_URL}/auth/student/phase-schedules/${myTeam._id}`, authHeader()),
        axios.get(`${API_URL}/auth/student/phase-documents/${myTeam._id}`, authHeader()),
      ]);
      setSchedules(schedulesRes.data.schedules || []);
      setDocuments(docsRes.data.documents || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load phase documents" });
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

  const handleUpload = async (schedule, file) => {
    if (!file) return;
    try {
      setUploading(schedule._id);
      const formData = new FormData();
      formData.append("document", file);
      formData.append("phaseScheduleId", schedule._id);
      formData.append("teamId", teamId);
      await axios.post(`${API_URL}/auth/student/phase-documents`, formData, {
        headers: { ...authHeader().headers, "Content-Type": "multipart/form-data" },
      });
      setMessage({ type: "success", text: "Document uploaded" });
      fetchAll();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to upload document" });
    } finally {
      setUploading(null);
    }
  };

  if (loading) return <div className={styles.container}><Loader text="Loading..." /></div>;

  if (!teamId) return <div className={styles.container}><div className={styles.emptyBox}>You're not part of an FYP group yet.</div></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaFileUpload /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Phase Documents</h1>
          <p className={styles.heroSub}>Upload required documents for your FYP phases</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Your Phase Schedules</h3>
        {schedules.length === 0 ? (
          <div className={styles.emptyBox}>No phases scheduled yet.</div>
        ) : (
          schedules.map((s) => {
            const doc = documents.find((d) => String(d.phaseId?._id || d.phaseId) === String(s.phaseId?._id));
            return (
              <div key={s._id} style={{ padding: "12px 0", borderTop: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{s.phaseId?.name}</strong>
                    <div style={{ fontSize: 12.5, color: "#6b7280" }}>
                      Scheduled: {new Date(s.scheduledDate).toLocaleDateString()} {s.room && `| Room: ${s.room}`}
                    </div>
                  </div>
                  {!s.phaseId?.requiresUpload ? (
                    <span className={`${styles.badge} ${styles.badgeGray}`}>No Upload Required</span>
                  ) : doc ? (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12.5, color: "#059669", fontWeight: 700 }}>Uploaded: {doc.fileName}</div>
                      <label className={`${styles.btn} ${styles.btnSecondary}`} style={{ marginTop: 6, cursor: "pointer" }}>
                        {uploading === s._id ? "Uploading..." : "Re-upload"}
                        <input type="file" hidden onChange={(e) => handleUpload(s, e.target.files[0])} />
                      </label>
                    </div>
                  ) : (
                    <label className={`${styles.btn} ${styles.btnPrimary}`} style={{ cursor: "pointer" }}>
                      {uploading === s._id ? "Uploading..." : "Upload"}
                      <input type="file" hidden onChange={(e) => handleUpload(s, e.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PhaseDocuments;
