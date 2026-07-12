import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import styles from "./styles.module.css";

const VerifyEmail = ({ role, loginPath }) => {
  const { token } = useParams();
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");

  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState("");

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Verification failed.");
        setStatus("success");
        setMessage(data.message);
      } catch (err) {
        setStatus("error");
        setMessage(err.message);
      }
    };
    verify();
  }, [role, token]);

  const handleResend = async () => {
    if (!recoveryEmail) return;
    setBusy(true);
    setRecoveryMsg("");
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoveryEmail, role }),
      });
      const data = await res.json();
      setRecoveryMsg(data.message || "Verification email sent.");
    } catch {
      setRecoveryMsg("Failed to resend. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    if (!recoveryEmail) { setRecoveryMsg("Please enter your current email first."); return; }
    setBusy(true);
    setRecoveryMsg("");
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/change-pending-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoveryEmail, newEmail, role }),
      });
      const data = await res.json();
      setRecoveryMsg(data.message);
    } catch {
      setRecoveryMsg("Failed to update email. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {status === "verifying" && (
          <>
            <div className={styles.spinner} />
            <h2 className={styles.heading}>Verifying your email...</h2>
            <p className={styles.subheading}>This will just take a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className={styles.iconSuccess}>✓</div>
            <h2 className={styles.heading}>Email Verified!</h2>
            <p className={styles.subheading}>{message}</p>
            <Link to={loginPath} className={styles.button}>Go to Login</Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className={styles.iconError}>✕</div>
            <h2 className={styles.heading}>Verification Failed</h2>
            <p className={styles.subheading}>{message}</p>

            <div className={styles.recoveryBox}>
              <p className={styles.recoveryLabel}>Need help? Enter your registered email:</p>
              <input
                type="email"
                placeholder="Your registered email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                className={styles.recoveryInput}
              />

              {recoveryMsg ? (
                <p className={styles.recoveryMsg}>{recoveryMsg}</p>
              ) : (
                <>
                  <div className={styles.verifyTabs}>
                    <button type="button" className={`${styles.verifyTab} ${!showChangeEmail ? styles.activeTab : ""}`} onClick={() => setShowChangeEmail(false)}>
                      Resend Email
                    </button>
                    <button type="button" className={`${styles.verifyTab} ${showChangeEmail ? styles.activeTab : ""}`} onClick={() => setShowChangeEmail(true)}>
                      Change Email
                    </button>
                  </div>

                  {!showChangeEmail ? (
                    <button type="button" onClick={handleResend} disabled={busy || !recoveryEmail} className={styles.recoveryBtn}>
                      {busy ? "Sending..." : "Resend Verification Email"}
                    </button>
                  ) : (
                    <form onSubmit={handleChangeEmail}>
                      <input
                        type="email"
                        placeholder="Enter your correct new email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                        className={styles.recoveryInput}
                      />
                      <button type="submit" disabled={busy || !recoveryEmail} className={styles.recoveryBtn}>
                        {busy ? "Updating..." : "Update & Send Verification"}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>

            <Link to={loginPath} className={styles.backLink}>← Back to Login</Link>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
