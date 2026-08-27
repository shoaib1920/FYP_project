import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { FaCog } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const SystemSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });

  useEffect(() => {
    axios.get(`${API_URL}/auth/settings`, authHeader())
      .then((res) => setSettings(res.data.settings))
      .catch(() => setMessage({ type: "error", text: "Failed to load settings" }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await axios.put(`${API_URL}/auth/admin/settings`, { groupFormationOpen: settings.groupFormationOpen }, authHeader());
      setSettings(res.data.settings);
      setMessage({ type: "success", text: "Settings saved" });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <div className={styles.container}><Loader text="Loading settings..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaCog /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Settings</h1>
          <p className={styles.heroSub}>Manage system settings</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Group Formation Settings</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#374151" }}>Group Formation</span>
          <div
            onClick={() => setSettings({ ...settings, groupFormationOpen: !settings.groupFormationOpen })}
            style={{
              width: 52, height: 28, borderRadius: 20, cursor: "pointer", padding: 3,
              background: settings.groupFormationOpen ? "#4f46e5" : "#e5e7eb", transition: "background .2s",
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: "50%", background: "white",
              transform: settings.groupFormationOpen ? "translateX(24px)" : "translateX(0)",
              transition: "transform .2s",
            }} />
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: "#9ca3af", marginBottom: 16 }}>
          {settings.groupFormationOpen ? "Open" : "Closed"} — controls whether students can currently create/join FYP teams.
        </p>
        <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default SystemSettings;
