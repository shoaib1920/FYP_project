import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaKey } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const PasswordResetRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [resolving, setResolving] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/auth/admin/password-reset-requests`, authHeader());
      setRequests(res.data.requests || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load requests" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const visible = filter === "ALL" ? requests : requests.filter((r) => r.status === filter);
  const counts = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "PENDING").length,
    resolved: requests.filter((r) => r.status === "RESOLVED").length,
  };

  const submitResolve = async (id) => {
    if (!newPassword || newPassword.length < 6) return;
    try {
      await axios.put(`${API_URL}/auth/admin/password-reset-requests/${id}/resolve`, { newPassword }, authHeader());
      setMessage({ type: "success", text: "Password reset and recorded" });
      setResolving(null);
      setNewPassword("");
      fetchRequests();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to resolve request" });
    }
  };

  if (loading) return <div className={styles.container}><Loader text="Loading requests..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaKey /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Password Reset Requests</h1>
          <p className={styles.heroSub}>Students and faculty who have requested a password reset</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.statsRow}>
        <div className={styles.statCard}><strong>{counts.total}</strong><span>Total</span></div>
        <div className={styles.statCard}><strong>{counts.pending}</strong><span>Pending</span></div>
        <div className={styles.statCard}><strong>{counts.resolved}</strong><span>Resolved</span></div>
      </div>

      <div className={styles.chipRow} style={{ marginBottom: 18 }}>
        {["ALL", "PENDING", "RESOLVED"].map((f) => (
          <span key={f} className={`${styles.chip} ${filter === f ? styles.chipActive : ""}`} onClick={() => setFilter(f)}>{f.charAt(0) + f.slice(1).toLowerCase()}</span>
        ))}
      </div>

      <div className={styles.card}>
        {visible.length === 0 ? (
          <div className={styles.emptyBox}>No requests.</div>
        ) : (
          visible.map((r) => (
            <div key={r._id} style={{ padding: "12px 0", borderTop: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{r.name}</strong>
                  <div style={{ fontSize: 12.5, color: "#6b7280" }}>
                    {r.email} • {r.role.charAt(0).toUpperCase() + r.role.slice(1)} • Requested {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                  {r.note && <div style={{ fontSize: 12.5, color: "#059669", marginTop: 4 }}>{r.note} • by Admin, {new Date(r.resolvedAt).toLocaleDateString()}</div>}
                </div>
                {r.status === "PENDING" ? (
                  resolving === r._id ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1.5px solid #e5e7eb" }} />
                      <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => submitResolve(r._id)}>Save</button>
                      <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setResolving(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setResolving(r._id)}>Resolve</button>
                  )
                ) : (
                  <span className={`${styles.badge} ${styles.badgeGreen}`}>Resolved</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PasswordResetRequests;
