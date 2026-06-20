import React, { useState, useEffect, useRef } from "react";
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
// import ManageTeams from "../Teams";



const Main = ({ defaultModule = "Dashboard" }) => {
	const navigate = useNavigate();
	const [activeModule, setActiveModule] = useState(defaultModule);
	const [studentName, setStudentName] = useState("");
	const [moreMenuOpen, setMoreMenuOpen] = useState(false);
	const moreMenuRef = useRef(null);

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

	useEffect(() => {
		const handleClickOutside = (e) => {
			if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
				setMoreMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const firstName = studentName ? studentName.split(" ")[0] : "Student";

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
				<div style={{ fontSize: "36px", fontWeight: "1000", color: "white" }}>
					👋 Hello, <span style={{ fontWeight: "bold" }}>{firstName}</span>
				</div>

				<div className={styles.nav_links}>
					<button onClick={() => ShowModule("Dashboard")}>Dashboard</button>
					<button onClick={() => ShowModule("StudentProposal")}>Proposals</button>
					<button onClick={() => ShowModule("my-tasks")}>Progress</button>
					<button onClick={() => ShowModule("create-tasks")}>project</button>
					<button onClick={() => ShowModule("Template-manager")}>Templates</button>
					<button onClick={() => ShowModule("Chats")}>Chats </button>
					{/* <button onClick={() => ShowModule("ManageTeams")}>Manage Teams</button> */}

					<div className={styles.more_menu_wrapper} ref={moreMenuRef}>
						<button
							className={styles.more_menu_btn}
							onClick={() => setMoreMenuOpen((prev) => !prev)}
							title="More options"
						>
							⋮
						</button>
						{moreMenuOpen && (
							<div className={styles.more_menu_dropdown}>
								<button
									onClick={() => {
										ShowModule("Feedback");
										setMoreMenuOpen(false);
									}}
								>
									Feedback & Review
								</button>
							</div>
						)}
					</div>
				</div>


				<Notifications onOpenRelated={() => ShowModule("create-tasks")} />

				<div className={styles.auth_buttons}>
					<button className={styles.logout} onClick={handleLogout}>
						Logout
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
