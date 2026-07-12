import { useState } from "react";
import { Link } from "react-router-dom";
import { FaUserGraduate, FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import styles from "./styles.module.css";

const Login = () => {
  const [data, setData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false); // Track animation state
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [changeMsg, setChangeMsg] = useState("");

  const handleResend = async () => {
    setResending(true);
    setResendMsg("");
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, role: "student" }),
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
        body: JSON.stringify({ email: data.email, newEmail, role: "student" }),
      });
      const result = await res.json();
      setChangeMsg(result.message);
    } catch {
      setChangeMsg("Failed to update email. Please try again.");
    } finally {
      setChangingEmail(false);
    }
  };

  const handleChange = ({ currentTarget: input }) => {
    setData({ ...data, [input.name]: input.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setErrorVisible(false); // Hide any previous error animations
    setUnverified(false);
    setResendMsg("");
    setLoading(true);

    const { email, password } = data;

    try {
      if (!email || !password) {
        setError("Please fill all the fields");
        setErrorVisible(true); // Start animation for showing error
        setLoading(false);

        // Hide error after 4 seconds with animation
        setTimeout(() => {
          setErrorVisible(false); // Trigger fade-out animation
          setTimeout(() => setError(""), 500); // Remove error after animation ends
        }, 4000);

        return;
      }

      const url = `${process.env.REACT_APP_API_URL}/auth/login`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
		console.log("errorDAta",errorData);
        const err = new Error(errorData.message || "Something went wrong");
        err.unverified = !!errorData.unverified;
        throw err;
      }

      const responseData = await response.json();
      console.log("Login Successful:", responseData);

      localStorage.setItem("token", responseData.token);
      localStorage.setItem("user", JSON.stringify(responseData.user));

      window.location.href = "/student/dashboard";
    } catch (error) {
      const isUnverified = !!error.unverified;
      setError(error.message);
      setUnverified(isUnverified);
      setErrorVisible(true); // Show error animation

      // Hide error after a few seconds, unless it's an unverified-email error
      // (keep that one visible so the "Resend" action stays usable).
      setTimeout(() => {
        setErrorVisible(false); // Trigger fade-out animation
        setTimeout(() => {
          if (!isUnverified) setError("");
        }, 500);
      }, isUnverified ? 8000 : 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.banner}>
          <div className={styles.bannerIcon}><FaUserGraduate /></div>
          <span className={styles.bannerTag}>Student Portal</span>
          <h1 className={styles.bannerTitle}>Welcome Back</h1>
          <p className={styles.bannerSubtitle}>Log in to continue working on your FYP.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <FaEnvelope className={styles.inputIcon} />
            <input
              type="email"
              placeholder="Email"
              name="email"
              onChange={handleChange}
              value={data.email}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <FaLock className={styles.inputIcon} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              name="password"
              onChange={handleChange}
              value={data.password}
              required
              className={styles.input}
              style={{ paddingRight: '40px' }}
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', padding: 0 }}>
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {error && (
            <div
              className={`${styles.error_msg} ${
                errorVisible ? styles.slide_in : styles.slide_out
              }`}
            >
              {error}
            </div>
          )}

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

          <Link to="/student/forgot-password" className={styles.forgot_link}>
            Forgot password?
          </Link>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.loader}></span> : "Login"}
          </button>

          <p className={styles.switchText}>
            New here?{" "}
            <Link to="/student/signup" className={styles.switchLink}>
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
