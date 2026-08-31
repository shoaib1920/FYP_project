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
import EvaluationPanels from "../EvaluationPanels";
import PhaseManagement from "../PhaseManagement";
import PhaseScheduling from "../PhaseScheduling";
import MarksManagement from "../MarksManagement";
import PhaseResults from "../PhaseResults";
import AcademicSessions from "../AcademicSessions";
import SystemSettings from "../SystemSettings";
import PasswordResetRequests from "../PasswordResetRequests";
import GroupTracking from "../GroupTracking";
import StudentsReport from "../StudentsReport";
import MarksReport from "../MarksReport";
// Hidden for now (not deleted) — see ShowModule nav below.
// import AuditLog from "../AuditLog";
// import Analytics from "../Analytics";


// Icons
import { FaHome, FaTasks, FaUserGraduate, FaUserTie, FaProjectDiagram, FaComments, FaSignOutAlt, FaFileUpload, FaFileSignature, FaBuilding, FaStar, FaShieldAlt, FaCalendarAlt, FaGavel, FaLayerGroup, FaClipboardList, FaTrophy, FaCog, FaKey, FaSearch, FaFileAlt, FaChartBar, FaBars, FaTimes } from "react-icons/fa";

const Main = ({ defaultModule = "Dashboard" }) => {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState(defaultModule);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
	setSidebarOpen(false); // close the mobile drawer after picking a section
	// navigate(`/${moduleName}`);
  };

  return (
	/* ...inside your component's return */
<div className={styles.main_wrapper}>
  <button className={styles.menu_btn} onClick={() => setSidebarOpen(true)}>
    <FaBars /> <span>Menu</span>
  </button>
  <div
    className={`${styles.backdrop} ${sidebarOpen ? styles.open : ""}`}
    onClick={() => setSidebarOpen(false)}
  />
  <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ""}`}>
    <div className={styles.sidebar_header}>
      <div className={styles.brand_icon}><FaShieldAlt /></div>
      <h2>Admin Panel</h2>
      <button className={styles.close_btn} onClick={() => setSidebarOpen(false)}><FaTimes /></button>
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

      <div className={styles.nav_section_label}>FYP Phases</div>
      <button onClick={() => ShowModule("EvaluationPanels")} className={activeModule === "EvaluationPanels" ? styles.active : ""}>
        <FaGavel /> Evaluation Panels
      </button>
      <button onClick={() => ShowModule("PhaseManagement")} className={activeModule === "PhaseManagement" ? styles.active : ""}>
        <FaLayerGroup /> Phase Management
      </button>
      <button onClick={() => ShowModule("PhaseScheduling")} className={activeModule === "PhaseScheduling" ? styles.active : ""}>
        <FaCalendarAlt /> Phase Scheduling
      </button>
      <button onClick={() => ShowModule("MarksManagement")} className={activeModule === "MarksManagement" ? styles.active : ""}>
        <FaClipboardList /> Manage Marks
      </button>
      <button onClick={() => ShowModule("PhaseResults")} className={activeModule === "PhaseResults" ? styles.active : ""}>
        <FaTrophy /> Phase Results
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

      {/* Analytics / Audit Trail nav hidden for now — not deleted, see AdminMain imports */}

      <div className={styles.nav_section_label}>Tracking</div>
      <button onClick={() => ShowModule("GroupTracking")} className={activeModule === "GroupTracking" ? styles.active : ""}>
        <FaSearch /> Group Tracking
      </button>

      <div className={styles.nav_section_label}>Reports</div>
      <button onClick={() => ShowModule("StudentsReport")} className={activeModule === "StudentsReport" ? styles.active : ""}>
        <FaFileAlt /> Students Report
      </button>
      <button onClick={() => ShowModule("MarksReport")} className={activeModule === "MarksReport" ? styles.active : ""}>
        <FaChartBar /> Marks Report
      </button>

      <div className={styles.nav_section_label}>System</div>
      <button onClick={() => ShowModule("AcademicSessions")} className={activeModule === "AcademicSessions" ? styles.active : ""}>
        <FaCalendarAlt /> Academic Sessions
      </button>
      <button onClick={() => ShowModule("PasswordResetRequests")} className={activeModule === "PasswordResetRequests" ? styles.active : ""}>
        <FaKey /> Password Resets
      </button>
      <button onClick={() => ShowModule("SystemSettings")} className={activeModule === "SystemSettings" ? styles.active : ""}>
        <FaCog /> Settings
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
    {activeModule === "EvaluationPanels" && <EvaluationPanels />}
    {activeModule === "PhaseManagement"  && <PhaseManagement />}
    {activeModule === "PhaseScheduling"  && <PhaseScheduling />}
    {activeModule === "MarksManagement"  && <MarksManagement />}
    {activeModule === "PhaseResults"     && <PhaseResults />}
    {activeModule === "GroupTracking"    && <GroupTracking />}
    {activeModule === "StudentsReport"   && <StudentsReport />}
    {activeModule === "MarksReport"      && <MarksReport />}
    {activeModule === "AcademicSessions" && <AcademicSessions />}
    {activeModule === "PasswordResetRequests" && <PasswordResetRequests />}
    {activeModule === "SystemSettings"   && <SystemSettings />}
    {activeModule === "ChatBox"          && <ChatBox />}
    {activeModule === "Feedback" && <Feedback />}
    {/* AuditLog / Analytics modules hidden for now — not deleted, see imports above */}
  </main>
</div>
  );
};

export default Main;
