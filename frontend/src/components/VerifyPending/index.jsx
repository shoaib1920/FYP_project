import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaEnvelope } from "react-icons/fa";
import styles from "./styles.module.css";

const VerifyPending = ({ role, loginPath }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(location.state?.email || "");
  const [newEmail, setNewEmail] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);
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
        setShowChangeForm(false);
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

        {/* Icon */}
        <div className={styles.iconWrap}>
          <FaEnvelope className={styles.icon} />
        </div>

        {/* Header */}
        <h2 className={styles.heading}>Check Your Inbox</h2>
        <p className={styles.subheading}>
          We sent a verification link to
        </p>
        <div className={styles.emailPill}>{email || "your email"}</div>
        <p className={styles.instruction}>
          Open the email and click the link to activate your account.
        </p>

        {/* Alert message */}
        {msg && (
          <div className={`${styles.alert} ${msgType === "error" ? styles.alertError : styles.alertSuccess}`}>
            {msg}
          </div>
        )}

        {/* Primary CTA */}
        <button
          type="button"
          onClick={() => checkAndRedirect(false)}
          disabled={checking || !email}
          className={styles.primaryBtn}
        >
          {checking ? "Checking..." : "I've Verified My Email"}
        </button>
        <p className={styles.autoCheck}>Page checks automatically every few seconds</p>

        <div className={styles.divider} />

        {/* Resend section */}
        <div className={styles.helpRow}>
          <span className={styles.helpQuestion}>Didn't receive the email?</span>
          <button type="button" onClick={handleResend} disabled={busy} className={styles.helpBtn}>
            {busy ? "Sending..." : "Resend verification email"}
          </button>
        </div>

        <div className={styles.divider} />

        {/* Change email section */}
        <div className={styles.helpRow}>
          <span className={styles.helpQuestion}>Used a wrong email address?</span>
          {!showChangeForm ? (
            <button type="button" onClick={() => setShowChangeForm(true)} className={styles.helpBtn}>
              Change email address
            </button>
          ) : (
            <form onSubmit={handleChangeEmail} className={styles.changeForm}>
              <input
                type="email"
                placeholder="Enter your correct email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className={styles.changeInput}
                autoFocus
              />
              <div className={styles.changeActions}>
                <button type="submit" disabled={busy} className={styles.changeSubmit}>
                  {busy ? "Updating..." : "Update & Resend"}
                </button>
                <button type="button" onClick={() => setShowChangeForm(false)} className={styles.changeCancelBtn}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};

export default VerifyPending;
