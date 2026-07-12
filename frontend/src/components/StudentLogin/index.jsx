import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import styles from "./styles.module.css";

const StudentLogin = () => {
  const [data, setData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const navigate = useNavigate();

  const handleChange = ({ currentTarget: input }) => {
    setData({ ...data, [input.name]: input.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setErrorVisible(false);
    setLoading(true);

    const { email, password } = data;

    try {
      if (!email || !password) {
        setError("Please fill all the fields");
        setErrorVisible(true);
        setLoading(false);

        setTimeout(() => {
          setErrorVisible(false);
          setTimeout(() => setError(""), 500);
        }, 4000);
        return;
      }

      const url = `${process.env.REACT_APP_API_URL || "http://127.0.0.1:8000"}/auth/login`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Invalid credentials");
      }

      const responseData = await response.json();
      console.log("Login Successful:", responseData);

      // Store auth data
      localStorage.setItem("token", responseData.token);
      
      localStorage.setItem("user", JSON.stringify(responseData.user));

      // Redirect to student dashboard
      navigate("/student/dashboard");
    } catch (error) {
      setError(error.message);
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
    <div className={styles.login_container}>
      <div className={styles.login_form_container}>
        <div className={styles.left}>
          <form className={styles.form_container} onSubmit={handleSubmit}>
            <h1>Student Login</h1>
            
            {error && (
              <div className={`${styles.error_msg} ${errorVisible ? styles.visible : ""}`}>
                {error}
              </div>
            )}

            <input
              type="email"
              placeholder="Email"
              name="email"
              onChange={handleChange}
              value={data.email}
              required
              className={styles.input}
            />
            
            <div style={{ position: 'relative' }}>
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
              <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', padding: 0 }}>
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <button type="submit" className={styles.green_btn} disabled={loading}>
              {loading ? "⏳ Logging in..." : "Login"}
            </button>

            <p className={styles.signup_link}>
              Don't have an account?{" "}
              <Link to="/student/signup">Sign Up here</Link>
            </p>
          </form>
        </div>

        <div className={styles.right}>
          <h1>Welcome Back!</h1>
          <p>Login to access your dashboard, manage your projects, and collaborate with your team.</p>
          <div className={styles.features}>
            <div className={styles.feature}>
              <span>📊</span> Track your progress
            </div>
            <div className={styles.feature}>
              <span>👥</span> Collaborate with teams
            </div>
            <div className={styles.feature}>
              <span>📁</span> Manage projects
            </div>
            <div className={styles.feature}>
              <span>💬</span> Real-time messaging
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;
