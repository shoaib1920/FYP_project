import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { FaUserShield, FaEnvelope, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import styles from './styles.module.css';

const AdminLogin = () => {
  const [admin, setAdmin] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [changeMsg, setChangeMsg] = useState('');
  const navigate = useNavigate();

  const handleResend = async () => {
    setResending(true);
    setResendMsg('');
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/auth/resend-verification`, {
        email: admin.email,
        role: 'admin',
      });
      setResendMsg(res.data.message || 'Verification email sent.');
    } catch (err) {
      setResendMsg('Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setChangingEmail(true);
    setChangeMsg('');
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/auth/change-pending-email`, {
        email: admin.email, newEmail, role: 'admin',
      });
      setChangeMsg(res.data.message);
    } catch (err) {
      setChangeMsg(err.response?.data?.message || 'Failed to update email. Please try again.');
    } finally {
      setChangingEmail(false);
    }
  };

  const handleLogin = async (e) => {
  e.preventDefault();
  setError('');
  setUnverified(false);
  setResendMsg('');
  setLoading(true);
  try {
    const res = await axios.post(`${process.env.REACT_APP_API_URL}/auth/admin_login`, admin);

    console.log(res);
    // Store both token and admin data
    localStorage.setItem("adminToken", res.data.token);
    localStorage.setItem("adminData", JSON.stringify(res.data.admin)); // assuming backend returns admin object


navigate('/admin/dashboard');

  } catch (error) {
    if (error.response?.data?.unverified) setUnverified(true);
    setError(error.response?.data?.message || error.message || "Login failed");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.banner}>
          <div className={styles.bannerIcon}><FaUserShield /></div>
          <span className={styles.bannerTag}>Admin Portal</span>
          <h1 className={styles.bannerTitle}>Welcome Back</h1>
          <p className={styles.bannerSubtitle}>Log in to manage the FYP portal.</p>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <FaEnvelope className={styles.inputIcon} />
            <input
              type="email"
              placeholder="Email"
              className={styles.input}
              value={admin.email}
              onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <FaLock className={styles.inputIcon} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className={styles.input}
              value={admin.password}
              onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
              required
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

          <Link to="/admin/forgot-password" className={styles.forgotLink}>
            Forgot password?
          </Link>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.loader}></span> : "Login"}
          </button>

          <p className={styles.switchText}>
            New here?{" "}
            <Link to="/admin/signup" className={styles.switchLink}>
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
