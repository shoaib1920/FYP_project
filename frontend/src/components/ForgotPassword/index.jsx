import React, { useState } from "react";
import { Link } from "react-router-dom";
import styles from "./styles.module.css";

const ROLE_LABELS = { student: "Student", supervisor: "Supervisor", admin: "Admin" };

const ForgotPassword = ({ role, loginPath }) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Something went wrong.");
      setStatus(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.heading}>Forgot Password</h2>
        <p className={styles.subheading}>
          Enter your {ROLE_LABELS[role] || "account"} email and we'll send you a link to reset your password.
        </p>

        {status ? (
          <div className={styles.successBox}>{status}</div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input}
            />
            {error && <div className={styles.errorBox}>{error}</div>}
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <Link to={loginPath} className={styles.backLink}>← Back to Login</Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
