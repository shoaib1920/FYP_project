import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FaCalendarCheck, FaHandshake, FaClock, FaMapMarkerAlt, FaVideo, FaUserTie,
} from "react-icons/fa";
import styles from "./styles.module.css";

/**
 * A consolidated, chronological view of the logged-in supervisor's upcoming
 * vivas and meetings across ALL their projects — previously only visible as
 * a small inline chip on each project's row, with no way to see everything
 * coming up at a glance.
 */
const UpcomingSchedule = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchedule = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/auth/supervisor/schedule`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setItems(res.data.items || []);
      } catch (err) {
        console.error("Failed to fetch supervisor schedule:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, []);

  if (loading) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <FaCalendarCheck className={styles.headerIcon} />
        <h3 className={styles.title}>Upcoming Schedule</h3>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>No vivas or meetings scheduled in the near future.</p>
      ) : (
        <div className={styles.list}>
          {items.map((item) => {
            const date = new Date(item.date);
            const daysLeft = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const soon = daysLeft <= 2;
            const formatted = date.toLocaleString("en-GB", {
              weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            });

            return (
              <div key={`${item.type}-${item.type === "VIVA" ? item.projectId : item.meetingId}`} className={`${styles.item} ${soon ? styles.itemSoon : ""}`}>
                <div className={styles.itemIconWrap}>
                  {item.type === "VIVA" ? <FaCalendarCheck /> : <FaHandshake />}
                </div>
                <div className={styles.itemBody}>
                  <div className={styles.itemTop}>
                    <span className={styles.itemType}>{item.type === "VIVA" ? "Viva Defense" : "Supervision Meeting"}</span>
                    <span className={styles.itemProject}>{item.projectTitle}</span>
                  </div>
                  <div className={styles.itemMeta}>
                    <span className={styles.metaChip}><FaClock /> {formatted}</span>
                    {item.type === "VIVA" && (
                      item.mode === "ONLINE" ? (
                        <span className={styles.metaChip}><FaVideo /> Online</span>
                      ) : item.venue ? (
                        <span className={styles.metaChip}><FaMapMarkerAlt /> {item.venue}</span>
                      ) : null
                    )}
                    {item.type === "VIVA" && item.examiners?.length > 0 && (
                      <span className={styles.metaChip}>
                        <FaUserTie /> {item.examiners.map((e) => e.name).join(", ")}
                      </span>
                    )}
                    {item.type === "MEETING" && item.agenda && (
                      <span className={styles.metaChip}>{item.agenda}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UpcomingSchedule;
