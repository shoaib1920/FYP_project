import React, { useState } from "react";
import styles from "./styles.module.css";
import { FaSyncAlt, FaExternalLinkAlt, FaTimes, FaGlobe } from "react-icons/fa";

const normalizeUrl = (url) => {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

const LivePreview = ({ url, title, onClose }) => {
  const [reloadKey, setReloadKey] = useState(0);
  const safeUrl = normalizeUrl(url);

  if (!safeUrl) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.browserBar}>
          <div className={styles.trafficDots}>
            <span className={styles.dotRed} />
            <span className={styles.dotYellow} />
            <span className={styles.dotGreen} />
          </div>

          <div className={styles.urlBox}>
            <FaGlobe className={styles.urlIcon} />
            <span className={styles.urlText}>{safeUrl}</span>
          </div>

          <button
            className={styles.iconBtn}
            onClick={() => setReloadKey((k) => k + 1)}
            title="Reload"
          >
            <FaSyncAlt />
          </button>
          <a
            className={styles.iconBtn}
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
          >
            <FaExternalLinkAlt />
          </a>
          <button className={styles.iconBtn} onClick={onClose} title="Close">
            <FaTimes />
          </button>
        </div>

        {title && <div className={styles.panelTitle}>{title}</div>}

        <div className={styles.frameWrap}>
          <iframe
            key={reloadKey}
            src={safeUrl}
            title={title || "Live preview"}
            className={styles.frame}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>

        <div className={styles.note}>
          If the preview stays blank, the site doesn't allow being embedded — use "Open in new tab" instead.
        </div>
      </div>
    </div>
  );
};

export default LivePreview;
