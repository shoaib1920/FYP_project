import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaUserTie, FaUser, FaEnvelope, FaLock, FaIdBadge, FaPhone, FaKey, FaCheckCircle, FaEye, FaEyeSlash } from "react-icons/fa";
import styles from "./styles.module.css";

const SupervisorSignup = () => {
	const [data, setData] = useState({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
		employeeId: "",
		phone: "",
		supervisorJoinCode: "",
	});
	const [departmentInfo, setDepartmentInfo] = useState(null);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [errorVisible, setErrorVisible] = useState(false);
	const [successVisible, setSuccessVisible] = useState(false);
	const [loading, setLoading] = useState(false);
	const [verifyingCode, setVerifyingCode] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const navigate = useNavigate();

	const handleChange = ({ currentTarget: input }) => {
		setData({ ...data, [input.name]: input.value });
	};

	// Verify supervisor join code
	const handleVerifyCode = async (e) => {
		e.preventDefault();

		if (!data.supervisorJoinCode.trim()) {
			setError("Please enter a supervisor join code");
			setErrorVisible(true);
			return;
		}

		try {
			setVerifyingCode(true);
			setError("");
			const response = await fetch(
				`${process.env.REACT_APP_API_URL || "http://127.0.0.1:8000"}/auth/verify-supervisor-join-code`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ joinCode: data.supervisorJoinCode }),
				}
			);

			const responseData = await response.json();

			if (!response.ok) {
				throw new Error(responseData.message || "Invalid supervisor join code");
			}

			setDepartmentInfo(responseData.department);
			setError("");
		} catch (error) {
			setError(error.message || "Failed to verify join code");
			setErrorVisible(true);
			setDepartmentInfo(null);
		} finally {
			setVerifyingCode(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		setSuccess("");
		setErrorVisible(false);
		setSuccessVisible(false);

		try {
			// Frontend validation
			if (!data.name || !data.email || !data.password || !data.confirmPassword || !data.employeeId || !data.phone || !data.supervisorJoinCode) {
				throw new Error("Please fill all the fields");
			}

			if (data.password !== data.confirmPassword) {
				throw new Error("Passwords do not match");
			}

			if (data.password.length < 6) {
				throw new Error("Password must be at least 6 characters long");
			}

			if (!departmentInfo) {
				throw new Error("Please verify your supervisor join code first");
			}

			const url = `${process.env.REACT_APP_API_URL || "http://127.0.0.1:8000"}/auth/supervisor/signup`;
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: data.name,
					email: data.email,
					password: data.password,
					phone: data.phone,
					employeeId: data.employeeId,
					supervisorJoinCode: data.supervisorJoinCode,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || "An error occurred during registration");
			}

			await response.json();
			navigate("/supervisor/verify-pending", { state: { email: data.email } });
		} catch (error) {
			setError(error.message || "An unexpected error occurred");
			setErrorVisible(true);
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
					<h1 className={styles.bannerTitle}>Create Your Account</h1>
					<p className={styles.bannerSubtitle}>Register to manage your department's projects, teams, and students.</p>
				</div>

				<form className={styles.form} onSubmit={handleSubmit}>
					{error && (
						<div className={`${styles.error} ${errorVisible ? styles.visible : ""}`}>
							{error}
						</div>
					)}

					{success && (
						<div className={`${styles.success} ${successVisible ? styles.visible : ""}`}>
							{success}
						</div>
					)}

					{departmentInfo && (
						<div className={styles.departmentInfo}>
							<h3><FaCheckCircle /> Verified Department</h3>
							<p><strong>Name:</strong> {departmentInfo.name}</p>
							<p><strong>Code:</strong> {departmentInfo.code}</p>
							<p><strong>Session:</strong> {departmentInfo.academicSession}</p>
						</div>
					)}

					<div className={styles.inputGroup}>
						<FaUser className={styles.inputIcon} />
						<input
							type="text"
							placeholder="Full Name"
							name="name"
							onChange={handleChange}
							value={data.name}
							required
							className={styles.input}
						/>
					</div>

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
						<FaIdBadge className={styles.inputIcon} />
						<input
							type="text"
							placeholder="Employee ID / Supervisor Code"
							name="employeeId"
							onChange={handleChange}
							value={data.employeeId}
							required
							className={styles.input}
						/>
					</div>

					<div className={styles.inputGroup}>
						<FaPhone className={styles.inputIcon} />
						<input
							type="tel"
							placeholder="Phone Number"
							name="phone"
							onChange={handleChange}
							value={data.phone}
							required
							className={styles.input}
						/>
					</div>

					<div className={styles.inputGroup}>
						<FaLock className={styles.inputIcon} />
						<input
							type={showPassword ? "text" : "password"}
							placeholder="Password (Min 6 characters)"
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

					<div className={styles.inputGroup}>
						<FaLock className={styles.inputIcon} />
						<input
							type={showConfirmPassword ? "text" : "password"}
							placeholder="Confirm Password"
							name="confirmPassword"
							onChange={handleChange}
							value={data.confirmPassword}
							disabled={!!departmentInfo}
							required
							className={styles.input}
							style={{ paddingRight: '40px' }}
						/>
						<button type="button" onClick={() => setShowConfirmPassword(v => !v)} style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', padding: 0 }}>
							{showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
						</button>
					</div>

					<div className={styles.joinCodeGroup}>
						<div className={styles.inputGroup} style={{ flex: 1 }}>
							<FaKey className={styles.inputIcon} />
							<input
								type="text"
								placeholder="Supervisor Join Code"
								name="supervisorJoinCode"
								onChange={handleChange}
								value={data.supervisorJoinCode}
								required
								className={styles.input}
							/>
						</div>
						<button
							type="button"
							onClick={handleVerifyCode}
							disabled={verifyingCode || !!departmentInfo}
							className={styles.verifyBtn}
						>
							{verifyingCode ? "Verifying..." : "Verify"}
						</button>
					</div>

					<button type="submit" className={styles.submitBtn} disabled={loading || !departmentInfo}>
						{loading ? <span className={styles.loader}></span> : "Sign Up"}
					</button>

					<p className={styles.switchText}>
						Already have an account?{" "}
						<Link to="/supervisor/login" className={styles.switchLink}>Login here</Link>
					</p>
				</form>
			</div>
		</div>
	);
};

export default SupervisorSignup;
