import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { FaUserShield, FaUser, FaEnvelope, FaLock } from 'react-icons/fa';
import styles from './styles.module.css';

const AdminSignup = () => {
  const [admin, setAdmin] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/auth/admin_signup`, admin);
      setSuccess('Admin registered successfully! Please check your email to verify your account before logging in.');
      setTimeout(() => navigate('/admin/login'), 3500);
    } catch (error) {
      setError(error.response?.data?.message || error.message || "Signup failed");
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
          <h1 className={styles.bannerTitle}>Create Your Account</h1>
          <p className={styles.bannerSubtitle}>Register a new administrator account.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <div className={styles.inputGroup}>
            <FaUser className={styles.inputIcon} />
            <input
              type="text"
              placeholder="Name"
              className={styles.input}
              value={admin.name}
              onChange={(e) => setAdmin({ ...admin, name: e.target.value })}
              required
            />
          </div>

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
              type="password"
              placeholder="Password"
              className={styles.input}
              value={admin.password}
              onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.loader}></span> : "Register"}
          </button>

          <p className={styles.switchText}>
            Already have an account?{" "}
            <Link to="/admin/login" className={styles.switchLink}>Login here</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default AdminSignup;
