import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { FaBell } from "react-icons/fa";
import styles from "./styles.module.css";

const API = process.env.REACT_APP_API_URL;
const POLL_INTERVAL = 25000;

function formatTimeAgo(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

const Notifications = ({ onOpenRelated }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await axios.get(`${API}/auth/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const handleToggle = () => {
    setOpen((prev) => !prev);
    if (!open) fetchNotifications();
  };

  const handleMarkAsRead = async (notification) => {
    if (notification.read) return;
    try {
      await axios.put(`${API}/auth/notifications/${notification._id}/read`, {}, authHeader());
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await axios.put(`${API}/auth/notifications/all/read`, {}, authHeader());
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    setDeletingId(notificationId);
    try {
      await axios.delete(`${API}/auth/notifications/${notificationId}`, authHeader());
      setNotifications((prev) => {
        const removed = prev.find((n) => n._id === notificationId);
        if (removed && !removed.read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n._id !== notificationId);
      });
    } catch (err) {
      console.error("Failed to delete notification:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleNotificationClick = (notification) => {
    handleMarkAsRead(notification);
    if (notification.relatedType === "project" && onOpenRelated) {
      onOpenRelated(notification.relatedType);
      setOpen(false);
    }
  };

  return (
    <div className={styles.wrapper} ref={panelRef}>
      <button className={styles.bellBtn} onClick={handleToggle} title="Notifications">
        <FaBell />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={handleMarkAllAsRead} disabled={markingAll}>
                {markingAll ? "Marking..." : "Mark all read"}
              </button>
            )}
          </div>

          <div className={styles.panelBody}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>🔔</span>
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className={`${styles.item} ${!n.read ? styles.unread : ""}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  {!n.read && <span className={styles.dot} />}
                  <div className={styles.itemContent}>
                    <span className={styles.itemTitle}>{n.title}</span>
                    <span className={styles.itemMessage}>{n.message}</span>
                    <span className={styles.itemTime}>{formatTimeAgo(n.createdAt)}</span>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDelete(e, n._id)}
                    disabled={deletingId === n._id}
                    title="Delete"
                  >
                    {deletingId === n._id ? "⏳" : "✕"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
