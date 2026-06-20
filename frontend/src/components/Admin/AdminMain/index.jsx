import React, { useState, useEffect } from "react";
import styles from "./styles.module.css";
import { useNavigate } from "react-router-dom";
import AdminDashboard from "../AdminDashboard";

import AllUserGroups from "../Students";
import Supervisors from "../Supervisors";
import TemplateManager from "../TemplateManager";
import ChatBox from "../ChatBox";
import AssignProjectForm from "../AssignProject";
import Feedback from "../Feedbacks";
import ProposalApprovals from "../ProjectProposals";
import DepartmentManagement from "../DepartmentManagement";
import GradeApproval from "../GradeApproval";
import AcademicCalendar from "../AcademicCalendar";


// Icons
import { FaHome, FaTasks, FaUserGraduate, FaUserTie, FaProjectDiagram, FaComments, FaSignOutAlt, FaFileUpload, FaFileSignature, FaBuilding, FaStar, FaShieldAlt, FaCalendarAlt } from "react-icons/fa";

const Main = ({ defaultModule = "Dashboard" }) => {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState(defaultModule);
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
	const userData = localStorage.getItem("adminData");
	if (userData) {
	  try {
		const parsedUser = JSON.parse(userData);
		setStudentName(parsedUser.name);
		console.log("✅ Loaded data:", parsedUser);
	  } catch (error) {
		console.error("❌ Failed to parse user from localStorage", error);
	  }
	}
  }, []);

  useEffect(() => {
	setActiveModule(defaultModule);
  }, [defaultModule]);

  const handleLogout = () => {
	localStorage.removeItem("adminData");   // remove user info
	localStorage.removeItem("adminToken");  // remove token
	navigate("/");     // redirect to login
  };
  

  const ShowModule = (moduleName) => {
	setActiveModule(moduleName);
	// navigate(`/${moduleName}`);
  };

  return (
	/* ...inside your component's return */
<div className={styles.main_wrapper}>
  <aside className={styles.sidebar}>
    <div className={styles.sidebar_header}>
      <div className={styles.brand_icon}><FaShieldAlt /></div>
      <h2>Admin Panel</h2>
    </div>

    <nav className={styles.sidebar_nav}>
      <button
        onClick={() => ShowModule("Dashboard")}
        className={activeModule === "Dashboard" ? styles.active : ""}
      >
        <FaHome /> Dashboard
      </button>

      <div className={styles.nav_section_label}>Workflow</div>
      <button
        onClick={() => ShowModule("proposal-approval")}
        className={activeModule === "proposal-approval" ? styles.active : ""}
      >
        <FaFileSignature /> Proposals
      </button>
      <button
        onClick={() => ShowModule("Projects")}
        className={activeModule === "Projects" ? styles.active : ""}
      >
        <FaProjectDiagram /> Projects
      </button>
      <button
        onClick={() => ShowModule("grade-approval")}
        className={activeModule === "grade-approval" ? styles.active : ""}
      >
        <FaStar /> Grade Approval
      </button>
      <button
        onClick={() => ShowModule("AcademicCalendar")}
        className={activeModule === "AcademicCalendar" ? styles.active : ""}
      >
        <FaCalendarAlt /> Academic Calendar
      </button>

      <div className={styles.nav_section_label}>Resources</div>
      <button
        onClick={() => ShowModule("DepartmentManagement")}
        className={activeModule === "DepartmentManagement" ? styles.active : ""}
      >
        <FaBuilding /> Departments
      </button>
      <button
        onClick={() => ShowModule("Supervisors")}
        className={activeModule === "Supervisors" ? styles.active : ""}
      >
        <FaUserTie /> Supervisors
      </button>
      <button
        onClick={() => ShowModule("AllUserGroups")}
        className={activeModule === "AllUserGroups" ? styles.active : ""}
      >
        <FaUserGraduate /> Students
      </button>
      <button
        onClick={() => ShowModule("ProjectTemplates")}
        className={activeModule === "ProjectTemplates" ? styles.active : ""}
      >
        <FaFileUpload /> Project&nbsp;Templates
      </button>
      <button
        onClick={() => ShowModule("ChatBox")}
        className={activeModule === "ChatBox" ? styles.active : ""}
      >
        <FaComments /> Chat
      </button>
      <button onClick={() => ShowModule("Feedback")} className={activeModule === "Feedback" ? styles.active : ""}>
        <FaTasks /> Feedback
      </button>

      <button onClick={handleLogout} className={styles.logout_btn}>
        <FaSignOutAlt /> Logout
      </button>
    </nav>
  </aside>

  <main className={styles.content_area}>
    {activeModule === "Dashboard"        && <AdminDashboard setActiveModule={setActiveModule} />}
    {activeModule === "DepartmentManagement" && <DepartmentManagement />}
    {activeModule === "Supervisors"      && <Supervisors />}
    {activeModule === "AllUserGroups"    && <AllUserGroups />}
    {activeModule === "ProjectTemplates" && <TemplateManager />}   {/* new */}
    {activeModule === "Projects"   && <AssignProjectForm />}
    {activeModule === "proposal-approval" && <ProposalApprovals />}
    {activeModule === "grade-approval"    && <GradeApproval />}
    {activeModule === "AcademicCalendar"  && <AcademicCalendar />}
    {activeModule === "ChatBox"          && <ChatBox />}
    {activeModule === "Feedback" && <Feedback />} 
  </main>
</div>
  );
};

export default Main;
