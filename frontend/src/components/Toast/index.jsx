import React, { useEffect, useState } from "react";
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from "react-icons/fa";
import { subscribeToasts, dismissToast } from "../../utils/toastStore";
import styles from "./styles.module.css";

const ICONS = {
  success: FaCheckCircle,
  error: FaExclamationCircle,
  warning: FaExclamationTriangle,
  info: FaInfoCircle,
};

/**
 * App-wide toast notification tray — mounted once at the app root (App.js).
 * Every other component triggers a toast by importing `showToast` from
 * utils/toastStore, replacing the browser's blocking window.alert().
 */
const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.tray} role="region" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || ICONS.info;
        return (
          <div key={t.id} className={`${styles.toast} ${styles[t.type] || styles.info}`}>
            <Icon className={styles.icon} />
            <span className={styles.message}>{t.message}</span>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
            >
              <FaTimes />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
