import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserAlt, FaEnvelope, FaLock, FaPhoneAlt, FaEye, FaEyeSlash } from 'react-icons/fa';
import styles from "./styles.module.css";

const SupervisorSignup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [data, setData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    department: "",
    designation: "Supervisor",
  });
  const [error, setError] = useState("");
  const [errorVisible, setErrorVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = ({ target }) => {
    setData({ ...data, [target.name]: target.value });
  };

  const validateForm = () => {
    if (!data.name || !/^[A-Za-z\s]+$/.test(data.name)) {
      setError("Name is required and should contain only letters and spaces.");
      setErrorVisible(true);
      return false;
    }

    if (!data.email || !/\S+@\S+\.\S+/.test(data.email)) {
      setError("Please enter a valid email address.");
      setErrorVisible(true);
      return false;
    }

    if (!data.password || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/.test(data.password)) {
      setError("Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, and one number.");
      setErrorVisible(true);
      return false;
    }

    if (data.phone && !/^\+?[1-9]\d{1,14}$/.test(data.phone)) {
      setError("Please enter a valid phone number.");
      setErrorVisible(true);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setTimeout(() => {
        setErrorVisible(false);
        setTimeout(() => setError(""), 500);
      }, 4000);
      return;
    }

    setLoading(true);
    setError("");
    setErrorVisible(false);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/supervisor/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Signup failed");
      }

      const resData = await response.json();
      localStorage.setItem("user", JSON.stringify(resData.user));
      navigate("/supervisor/dashboard");
    } catch (error) {
      setError(error.message || "Unexpected error occurred");
      setErrorVisible(true);
      setTimeout(() => {
        setErrorVisible(false);
        setTimeout(() => setError(""), 500);
      }, 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.signupContainer}>
        <div className={styles.iconContainer}>
          <FaUserAlt size={50} color="#4caf50" /> {/* Green Icon */}
        </div>

        <div className={styles.signupTitle}>Supervisor Signup</div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputContainer}>
            <FaUserAlt className={styles.inputIcon} />
            <input
              type="text"
              name="name"
              value={data.name}
              onChange={handleChange}
              placeholder="Full Name"
              required
            />
          </div>

          <div className={styles.inputContainer}>
            <FaEnvelope className={styles.inputIcon} />
            <input
              type="email"
              name="email"
              value={data.email}
              onChange={handleChange}
              placeholder="Email"
              required
            />
          </div>

          <div className={styles.inputContainer}>
            <FaLock className={styles.inputIcon} />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={data.password}
              onChange={handleChange}
              placeholder="Password"
              required
              style={{ paddingRight: '40px' }}
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', padding: 0 }}>
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <div className={styles.inputContainer}>
            <FaPhoneAlt className={styles.inputIcon} />
            <input
              type="text"
              name="phone"
              value={data.phone}
              onChange={handleChange}
              placeholder="Phone (Optional)"
            />
          </div>

          <div className={styles.inputContainer}>
            <input
              type="text"
              name="department"
              value={data.department}
              onChange={handleChange}
              placeholder="Department (Optional)"
            />
          </div>

          <div className={styles.inputContainer}>
            <input
              type="text"
              name="designation"
              value={data.designation}
              onChange={handleChange}
              placeholder="Designation"
              disabled
            />
          </div>

          {error && (
            <div
              className={`${styles.error_msg} ${
                errorVisible ? styles.fadeIn : styles.fadeOut
              }`}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className={`${styles.signupButton} ${loading ? styles.loadingButton : ""}`}
          >
            {loading ? <span className={styles.loader}></span> : "Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SupervisorSignup;
