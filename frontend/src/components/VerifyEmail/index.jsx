import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import styles from "./styles.module.css";

const VerifyEmail = ({ role, loginPath }) => {
  const { token } = useParams();
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

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
            <Link to={loginPath} className={styles.backLink}>← Back to Login</Link>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
