import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaUserTie, FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import styles from "./styles.module.css";

const SupervisorLogin = () => {
  const [data, setData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [changeMsg, setChangeMsg] = useState("");
  const navigate = useNavigate();

  const handleResend = async () => {
    setResending(true);
    setResendMsg("");
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, role: "supervisor" }),
      });
      const result = await res.json();
      setResendMsg(result.message || "Verification email sent.");
    } catch (err) {
      setResendMsg("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setChangingEmail(true);
    setChangeMsg("");
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/change-pending-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, newEmail, role: "supervisor" }),
      });
      const result = await res.json();
      setChangeMsg(result.message);
    } catch {
      setChangeMsg("Failed to update email. Please try again.");
    } finally {
      setChangingEmail(false);
    }
  };

  const handleChange = ({ target }) => {
    setData({ ...data, [target.name]: target.value });
  };

  const validate = () => {
    if (!/\S+@\S+\.\S+/.test(data.email)) {
      setError("Enter a valid email address.");
      return false;
    }
    if (!data.password || data.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setUnverified(false);
    setResendMsg("");

    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/supervisor/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (!res.ok) {
        if (result.unverified) setUnverified(true);
        throw new Error(result.message || "Login failed");
      }

     // ✅ Now you can safely access result.token
     localStorage.setItem("token", result.token);
     localStorage.setItem("supervisorData", JSON.stringify(result.user));

      navigate("/supervisor/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.banner}>
          <div className={styles.bannerIcon}><FaUserTie /></div>
          <span className={styles.bannerTag}>Supervisor Portal</span>
          <h1 className={styles.bannerTitle}>Welcome Back</h1>
          <p className={styles.bannerSubtitle}>Log in to manage your students and projects.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <FaEnvelope className={styles.inputIcon} />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={data.email}
              onChange={handleChange}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <FaLock className={styles.inputIcon} />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={data.password}
              onChange={handleChange}
              required
              className={styles.input}
              style={{ paddingRight: '40px' }}
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', padding: 0 }}>
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          {unverified && (
            <div className={styles.resendBox}>
              {changeMsg || resendMsg ? (
                <span className={styles.verifyMsg}>{changeMsg || resendMsg}</span>
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
                    <button type="button" onClick={handleResend} disabled={resending} className={styles.resendBtn}>
                      {resending ? "Sending..." : "Resend verification email"}
                    </button>
                  ) : (
                    <form onSubmit={handleChangeEmail} className={styles.changeEmailForm}>
                      <input
                        type="email"
                        placeholder="Enter your correct email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                        className={styles.changeEmailInput}
                      />
                      <button type="submit" disabled={changingEmail} className={styles.changeEmailBtn}>
                        {changingEmail ? "Updating..." : "Update & Send Verification"}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}

          <Link to="/supervisor/forgot-password" className={styles.forgotLink}>
            Forgot password?
          </Link>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.loader}></span> : "Login"}
          </button>

          <p className={styles.switchText}>
            New here?{" "}
            <Link to="/supervisor/signup" className={styles.switchLink}>
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SupervisorLogin;
