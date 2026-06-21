import React, { useState, useEffect } from "react";
import styles from "./styles.module.css";
import { useNavigate } from "react-router-dom";
import Dashboard from "../Dashboard";
import CreateTask from "../CreateTask";
import AssignTask from "../AssignTask";
import MyTasks from "../MyTasks";
import TemplateManager from "../TemplateManager";
import ChatBox from "../ChatBox";
import Feedback from "../Feedbacks";
import StudentProposal from "../StudentProposal";
import Notifications from "../Notifications";
import AIAssistant from "../AIAssistant";
import {
	FaGraduationCap,
	FaHome,
	FaFileSignature,
	FaChartLine,
	FaProjectDiagram,
	FaFileUpload,
	FaComments,
	FaCommentDots,
	FaSignOutAlt,
} from "react-icons/fa";
// import ManageTeams from "../Teams";



const Main = ({ defaultModule = "Dashboard" }) => {
	const navigate = useNavigate();
	const [activeModule, setActiveModule] = useState(defaultModule);
	const [studentName, setStudentName] = useState("");

	useEffect(() => {
		const userData = localStorage.getItem("user");
		if (userData) {
			try {
				const parsedUser = JSON.parse(userData);
				setStudentName(parsedUser.name);
				console.log("✅ Loaded student name:", parsedUser.name);
			} catch (error) {
				console.error("❌ Failed to parse user from localStorage", error);
			}
		}
	}, []);

	const firstName = studentName ? studentName.split(" ")[0] : "Student";
	const initials = studentName
		? studentName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
		: "ST";

	// 👇 New useEffect to handle prop updates
	useEffect(() => {
		setActiveModule(defaultModule);
	}, [defaultModule]);

	const handleLogout = () => {
		localStorage.removeItem("user"); // 👈 remove user data from localStorage
		navigate("/"); // 👈 redirect to login page
	  };
	

	// const ShowModule = (moduleName) => {
	// 	setActiveModule(moduleName);

	// };
	
	const ShowModule = (moduleName) => {
		setActiveModule(moduleName);
		navigate(`/student/${moduleName}`); // 👈 update URL
	};

	return (
		<div className={styles.main_container}>
			<nav className={styles.navbar}>
				<div className={styles.brand}>
					<div className={styles.brand_icon}><FaGraduationCap /></div>
					<h2>Student Portal</h2>
				</div>

				<div className={styles.nav_links}>
					<button
						onClick={() => ShowModule("Dashboard")}
						className={activeModule === "Dashboard" ? styles.active : ""}
					>
						<FaHome /> <span>Dashboard</span>
					</button>
					<button
						onClick={() => ShowModule("StudentProposal")}
						className={activeModule === "StudentProposal" ? styles.active : ""}
					>
						<FaFileSignature /> <span>Proposals</span>
					</button>
					<button
						onClick={() => ShowModule("my-tasks")}
						className={activeModule === "MyTasks" ? styles.active : ""}
					>
						<FaChartLine /> <span>Progress</span>
					</button>
					<button
						onClick={() => ShowModule("create-tasks")}
						className={activeModule === "CreateTask" ? styles.active : ""}
					>
						<FaProjectDiagram /> <span>Project</span>
					</button>
					<button
						onClick={() => ShowModule("Template-manager")}
						className={activeModule === "Template-manager" ? styles.active : ""}
					>
						<FaFileUpload /> <span>Templates</span>
					</button>
					<button
						onClick={() => ShowModule("Chats")}
						className={activeModule === "ChatBox" ? styles.active : ""}
					>
						<FaComments /> <span>Chats</span>
					</button>
					<button
						onClick={() => ShowModule("Feedback")}
						className={activeModule === "Feedback" ? styles.active : ""}
					>
						<FaCommentDots /> <span>Feedback</span>
					</button>
					{/* <button onClick={() => ShowModule("ManageTeams")}>Manage Teams</button> */}
				</div>

				<div className={styles.navbar_right}>
					<Notifications onOpenRelated={() => ShowModule("create-tasks")} />

					<div className={styles.profile_chip}>
						<div className={styles.profile_avatar}>{initials}</div>
						<span className={styles.profile_name}>{firstName}</span>
					</div>

					<button className={styles.logout_btn} onClick={handleLogout}>
						<FaSignOutAlt /> Logout
					</button>
				</div>
			</nav>

			<div className={styles.module_container}>
				{activeModule === "Dashboard" && <Dashboard setActiveModule={setActiveModule} />}
				{activeModule === "StudentProposal" && <StudentProposal />}
				{activeModule === "MyTasks" && <MyTasks />}
				{activeModule === "CreateTask" && <CreateTask />}
				{activeModule === "AssignTask" && <AssignTask />}
				{activeModule === "Template-manager" && <TemplateManager />}

				{activeModule === "ChatBox" && <ChatBox />}
				{activeModule === "Feedback" && <Feedback />}
				{/* {activeModule === "ManageTeams" && <ManageTeams />} */}

			</div>

			<AIAssistant />
		</div>
	);
};

export default Main;
