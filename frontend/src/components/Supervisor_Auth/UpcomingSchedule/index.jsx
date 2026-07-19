import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FaCalendarCheck, FaHandshake, FaClock, FaMapMarkerAlt, FaVideo, FaUserTie, FaTimes,
} from "react-icons/fa";
import styles from "./styles.module.css";

const DAYS_WINDOW = 3;

const ScheduleItem = ({ item }) => {
  const date = new Date(item.date);
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const soon = daysLeft <= 2;
  const formatted = date.toLocaleString("en-GB", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className={`${styles.item} ${soon ? styles.itemSoon : ""}`}>
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
};

/**
 * A consolidated, chronological view of the logged-in supervisor's upcoming
 * vivas and meetings across ALL their projects — previously only visible as
 * a small inline chip on each project's row, with no way to see everything
 * coming up at a glance.
 *
 * Only shows items due within DAYS_WINDOW days inline so the dashboard's
 * height stays constant regardless of how many projects/vivas/meetings
 * exist; the rest are one click away in a "View All" modal rather than
 * growing the page.
 */
const UpcomingSchedule = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

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

  const msPerDay = 1000 * 60 * 60 * 24;
  const visibleItems = items.filter(
    (item) => Math.ceil((new Date(item.date).getTime() - Date.now()) / msPerDay) <= DAYS_WINDOW
  );
  const remaining = items.length - visibleItems.length;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <FaCalendarCheck className={styles.headerIcon} />
        <h3 className={styles.title}>Upcoming Schedule</h3>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>No vivas or meetings scheduled in the near future.</p>
      ) : (
        <>
          {visibleItems.length === 0 ? (
            <p className={styles.empty}>No vivas or meetings in the next {DAYS_WINDOW} days.</p>
          ) : (
            <div className={styles.list}>
              {visibleItems.map((item) => (
                <ScheduleItem key={`${item.type}-${item.type === "VIVA" ? item.projectId : item.meetingId}`} item={item} />
              ))}
            </div>
          )}
          {remaining > 0 && (
            <button type="button" className={styles.viewAllBtn} onClick={() => setShowAll(true)}>
              View All ({items.length})
            </button>
          )}
        </>
      )}

      {showAll && (
        <div className={styles.overlay} onClick={() => setShowAll(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.title}>All Upcoming Vivas &amp; Meetings</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setShowAll(false)}><FaTimes /></button>
            </div>
            <div className={styles.modalList}>
              {items.map((item) => (
                <ScheduleItem key={`${item.type}-${item.type === "VIVA" ? item.projectId : item.meetingId}`} item={item} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpcomingSchedule;
