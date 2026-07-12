import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import styles from "./styles.module.css";

const Signup = () => {
	const [data, setData] = useState({
		firstName: "",
		lastName: "",
		email: "",
		password: "",
	});
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [errorVisible, setErrorVisible] = useState(false); // Animation state for error
	const [loading, setLoading] = useState(false); // Loader state
	const navigate = useNavigate();

	const handleChange = ({ currentTarget: input }) => {
		setData({ ...data, [input.name]: input.value });
	};

	const handleSubmit = async (e) => {
	e.preventDefault();

	// Start loader
	setLoading(true);
	setError("");
	setErrorVisible(false);

	try {
		// Frontend validation
		if (!data.firstName || !data.lastName || !data.email || !data.password) {
			setLoading(false);
			setError("Please fill all the fields");
			setErrorVisible(true);

			// Hide error after 4 seconds with animation
			setTimeout(() => {
				setErrorVisible(false); // Start fade-out animation
				setTimeout(() => setError(""), 500); // Clear error after animation ends
			}, 4000);

			return;
		}

		const name = `${data.firstName} ${data.lastName}`;
		const email = data.email;
		const password = data.password;

		// API call using fetch
		const url = "http://127.0.0.1:8000/auth/signup";
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name, email, password }),
		});

		// Check if the response is OK
		if (!response.ok) {
			const errorData = await response.json();
			console.log("Error Data:", errorData);
			throw new Error(errorData.message?errorData.message : errorData.details[0].message || "An error occurred");
		}
		console.log("Response Status:", response);

		// Parse the response data
		const responseData = await response.json();
		console.log("Response Data:", responseData);

		// Store user info in localStorage
		localStorage.setItem("user", JSON.stringify(responseData.user));

		// Redirect to the homepage
		navigate("/student/login");
	} catch (error) {
		// Handle backend and unexpected errors
		console.error("Error:", error.message);

		// Show backend error or fallback error
		setError(error.message || "An unexpected error occurred");
		setErrorVisible(true);

		// Hide error after 4 seconds with animation
		setTimeout(() => {
			setErrorVisible(false); // Start fade-out animation
			setTimeout(() => setError(""), 500); // Clear error after animation ends
		}, 4000);
	} finally {
		// Stop loader
		setLoading(false);
	}
};


	return (
		<div className={styles.signup_container}>
			<div className={styles.signup_form_container}>
				<div className={styles.left}>
					<h1>Welcome Back</h1>
					<Link to="/student/login">
						<button type="button" className={styles.white_btn}>
							Sign In
						</button>
					</Link>
				</div>
				<div className={styles.right}>
					<form className={styles.form_container} onSubmit={handleSubmit}>
						<h1>Create Account</h1>
						<input
							type="text"
							placeholder="First Name"
							name="firstName"
							onChange={handleChange}
							value={data.firstName}
							required
							className={styles.input}
						/>
						<input
							type="text"
							placeholder="Last Name"
							name="lastName"
							onChange={handleChange}
							value={data.lastName}
							required
							className={styles.input}
						/>
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
						{/* Error message with animation */}
						{error && (
							<div
								className={`${styles.error_msg} ${
									errorVisible ? styles.slide_in : styles.slide_out
								}`}
							>
								{error}
							</div>
						)}
						
						{/* Loader */}
						{loading ? (
							<button type="submit" className={styles.green_btn}>
								<span className={styles.loader}></span>
							</button>
						) : (
							<button type="submit" className={styles.green_btn}>
								Sign Up
							</button>
						)}
					</form>
				</div>
			</div>
		</div>
	);
};

export default Signup;
