import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FaCalendarCheck, FaClock, FaMapMarkerAlt, FaVideo, FaUserTie, FaUsers, FaTimes,
} from "react-icons/fa";
import styles from "./styles.module.css";

const DAYS_WINDOW = 3;

const VivaItem = ({ item }) => {
  const date = new Date(item.date);
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const soon = daysLeft <= 1;
  const formatted = date.toLocaleString("en-GB", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className={`${styles.item} ${soon ? styles.itemSoon : ""}`}>
      <div className={styles.itemIconWrap}>
        <FaCalendarCheck />
      </div>
      <div className={styles.itemBody}>
        <div className={styles.itemTop}>
          <span className={styles.itemType}>Viva Defense</span>
          <span className={styles.itemProject}>{item.projectTitle}</span>
        </div>
        <div className={styles.itemMeta}>
          <span className={styles.metaChip}><FaClock /> {formatted}</span>
          {item.mode === "ONLINE" ? (
            <span className={styles.metaChip}><FaVideo /> Online</span>
          ) : item.venue ? (
            <span className={styles.metaChip}><FaMapMarkerAlt /> {item.venue}</span>
          ) : null}
          {item.supervisorName && (
            <span className={styles.metaChip}><FaUserTie /> {item.supervisorName}</span>
          )}
          {item.examiners?.length > 0 && (
            <span className={styles.metaChip}>
              <FaUsers /> {item.examiners.map((e) => e.name).join(", ")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Department-wide upcoming vivas for admin — mirrors the supervisor's
 * Upcoming Schedule widget, but scoped to vivas only (no meetings, since
 * those are a supervisor/student concern) and filtered to the next
 * DAYS_WINDOW days by default so the dashboard stays uncluttered. Anything
 * further out is one click away in a "View All" modal instead of growing
 * the page.
 */
const UpcomingVivas = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchSchedule = async () => {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/auth/admin/viva-schedule`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setItems(res.data.items || []);
      } catch (err) {
        console.error("Failed to fetch admin viva schedule:", err);
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
        <h3 className={styles.title}>Upcoming Vivas</h3>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>No vivas scheduled.</p>
      ) : (
        <>
          {visibleItems.length === 0 ? (
            <p className={styles.empty}>No vivas in the next {DAYS_WINDOW} days.</p>
          ) : (
            <div className={styles.list}>
              {visibleItems.map((item) => (
                <VivaItem key={item.projectId} item={item} />
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
              <h3 className={styles.title}>All Upcoming Vivas</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setShowAll(false)}><FaTimes /></button>
            </div>
            <div className={styles.modalList}>
              {items.map((item) => (
                <VivaItem key={item.projectId} item={item} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpcomingVivas;
