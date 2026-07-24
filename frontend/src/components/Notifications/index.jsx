import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { FaRegBell, FaBellSlash, FaTimes } from "react-icons/fa";
import styles from "./styles.module.css";

const API = process.env.REACT_APP_API_URL;
const POLL_INTERVAL = 25000; // fallback only — new_notification socket event is the primary path now

// Keyed by tokenKey (student/supervisor/admin all share this one component)
// so each role's bell gets its own connection rather than accidentally
// reusing another role's socket if more than one were ever mounted at once.
const socketInstances = {};
function getNotifSocket(tokenKey, token) {
  if (!socketInstances[tokenKey] || !socketInstances[tokenKey].connected) {
    socketInstances[tokenKey] = io(API, {
      auth: { token },
      transports: ["polling"],
      reconnectionAttempts: 5,
    });
  }
  return socketInstances[tokenKey];
}

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

const Notifications = ({ onOpenRelated, tokenKey = "token" }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem(tokenKey);
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
  }, [tokenKey]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Real-time push — a new notification appears instantly instead of waiting
  // for the next poll or a manual reload.
  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    const socket = getNotifSocket(tokenKey, token);
    const handleNew = (notification) => {
      setNotifications((prev) => {
        if (prev.some((n) => String(n._id) === String(notification._id))) return prev;
        return [notification, ...prev];
      });
      setUnreadCount((prev) => prev + 1);
    };

    socket.on("new_notification", handleNew);
    return () => socket.off("new_notification", handleNew);
  }, [tokenKey]);

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
    headers: { Authorization: `Bearer ${localStorage.getItem(tokenKey)}` },
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
        <FaRegBell />
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
                <FaBellSlash className={styles.emptyIcon} />
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
                    <FaTimes />
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
