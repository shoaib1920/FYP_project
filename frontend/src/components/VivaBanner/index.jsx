import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FaCalendarCheck, FaExclamationTriangle, FaMapMarkerAlt,
  FaVideo, FaUserTie, FaInfoCircle, FaClock, FaCheckCircle,
} from "react-icons/fa";
import styles from "./styles.module.css";

/**
 * Shows the logged-in student's own viva defense — scheduled countdown with
 * logistics (date/time, location or join link, panel, prep instructions),
 * or a short "completed" note once graded. Renders nothing if no viva has
 * been scheduled yet.
 */
const VivaBanner = ({ tokenKey = "token" }) => {
  const [viva, setViva] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchViva = async () => {
      const token = localStorage.getItem(tokenKey);
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/auth/my-viva`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setViva(res.data.viva || null);
      } catch (err) {
        console.error("Failed to fetch viva info:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchViva();
  }, [tokenKey]);

  if (loading || !viva) return null;

  if (viva.status === "GRADED") {
    return (
      <div className={`${styles.banner} ${styles.toneGreen}`}>
        <FaCheckCircle className={styles.icon} />
        <div className={styles.body}>
          <strong>Viva completed</strong> — your defense for "{viva.projectTitle}" has been graded.
        </div>
      </div>
    );
  }

  const scheduledDate = new Date(viva.scheduledAt);
  const daysLeft = Math.ceil((scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const passed = daysLeft < 0;
  const urgent = !passed && daysLeft <= 3;
  const tone = passed ? styles.toneRed : urgent ? styles.toneAmber : styles.toneBlue;

  const formattedDateTime = scheduledDate.toLocaleString("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const countdown = passed
    ? "already passed — awaiting your grade"
    : daysLeft === 0
    ? "today"
    : daysLeft === 1
    ? "tomorrow"
    : `in ${daysLeft} days`;

  return (
    <div className={`${styles.banner} ${tone}`}>
      {passed ? <FaExclamationTriangle className={styles.icon} /> : <FaCalendarCheck className={styles.icon} />}
      <div className={styles.body}>
        <div className={styles.headline}>
          <strong>Viva Defense Scheduled</strong> — {countdown}
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaItem}>
            <FaClock /> {formattedDateTime}{viva.durationMinutes ? ` · ${viva.durationMinutes} min` : ""}
          </span>
          {viva.mode === "ONLINE" ? (
            viva.meetingLink ? (
              <a className={styles.metaItem} href={viva.meetingLink} target="_blank" rel="noopener noreferrer">
                <FaVideo /> Join online
              </a>
            ) : (
              <span className={styles.metaItem}><FaVideo /> Online (link to follow)</span>
            )
          ) : (
            viva.venue && <span className={styles.metaItem}><FaMapMarkerAlt /> {viva.venue}</span>
          )}
          {viva.examiners?.length > 0 && (
            <span className={styles.metaItem}>
              <FaUserTie /> {viva.examiners.map((e) => (e.role ? `${e.name} (${e.role})` : e.name)).join(", ")}
            </span>
          )}
        </div>
        {viva.instructions && (
          <div className={styles.instructions}>
            <FaInfoCircle /> {viva.instructions}
          </div>
        )}
      </div>
    </div>
  );
};

export default VivaBanner;
