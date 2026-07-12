import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaEnvelope } from "react-icons/fa";
import styles from "./styles.module.css";

const VerifyPending = ({ role, loginPath }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(location.state?.email || "");
  const [newEmail, setNewEmail] = useState("");
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("");
  const [checking, setChecking] = useState(false);

  const checkAndRedirect = useCallback(async (silent = false) => {
    if (!email) return;
    if (!silent) setChecking(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/check-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (data.verified) navigate(loginPath, { state: { justVerified: true } });
    } catch {}
    finally { if (!silent) setChecking(false); }
  }, [email, role, loginPath, navigate]);

  useEffect(() => {
    if (!email) return;
    const id = setInterval(() => checkAndRedirect(true), 8000);
    return () => clearInterval(id);
  }, [email, checkAndRedirect]);

  const handleResend = async () => {
    if (!email) { setMsg("Please enter your email first."); setMsgType("error"); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      setMsg(data.message || "Verification email sent.");
      setMsgType("success");
    } catch {
      setMsg("Failed to resend. Please try again.");
      setMsgType("error");
    } finally { setBusy(false); }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/change-pending-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newEmail, role }),
      });
      const data = await res.json();
      if (data.success) {
        setEmail(newEmail);
        setNewEmail("");
        setShowChangeEmail(false);
      }
      setMsg(data.message);
      setMsgType(data.success ? "success" : "error");
    } catch {
      setMsg("Failed to update email. Please try again.");
      setMsgType("error");
    } finally { setBusy(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.envelope}>
          <FaEnvelope />
        </div>

        <h2 className={styles.heading}>Check Your Inbox</h2>
        <p className={styles.subheading}>
          We sent a verification link to{" "}
          <strong className={styles.emailBadge}>{email || "your email"}</strong>.
          Open that email and click the link to activate your account.
        </p>

        {msg && (
          <p className={`${styles.alertMsg} ${msgType === "error" ? styles.alertError : styles.alertSuccess}`}>
            {msg}
          </p>
        )}

        {!msg && (
          <div className={styles.actionBox}>
            <div className={styles.verifyTabs}>
              <button
                type="button"
                className={`${styles.verifyTab} ${!showChangeEmail ? styles.activeTab : ""}`}
                onClick={() => setShowChangeEmail(false)}
              >
                Resend Email
              </button>
              <button
                type="button"
                className={`${styles.verifyTab} ${showChangeEmail ? styles.activeTab : ""}`}
                onClick={() => setShowChangeEmail(true)}
              >
                Wrong Email?
              </button>
            </div>

            {!showChangeEmail ? (
              <button type="button" onClick={handleResend} disabled={busy} className={styles.actionBtn}>
                {busy ? "Sending..." : "Resend Verification Email"}
              </button>
            ) : (
              <form onSubmit={handleChangeEmail}>
                <input
                  type="email"
                  placeholder="Enter your correct email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className={styles.actionInput}
                />
                <button type="submit" disabled={busy} className={styles.actionBtn}>
                  {busy ? "Updating..." : "Update & Resend Verification"}
                </button>
              </form>
            )}
          </div>
        )}

        <hr className={styles.divider} />

        <button
          type="button"
          onClick={() => checkAndRedirect(false)}
          disabled={checking || !email}
          className={styles.checkBtn}
        >
          {checking ? "Checking..." : "I've verified my email →"}
        </button>

        <p className={styles.autoCheck}>This page checks automatically every few seconds.</p>
      </div>
    </div>
  );
};

export default VerifyPending;
