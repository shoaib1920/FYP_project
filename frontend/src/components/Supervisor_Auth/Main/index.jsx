import React, { useState, useEffect } from "react";
import styles from "./styles.module.css";
import { useNavigate } from "react-router-dom";
import Dashboard from "../Dashboard";
import AssignProject from "../AssignProject";
import CreateProject from "../CreateProject";
import AllUserGroups from "../Students";
// import TemplateManager from "../TemplateManager";
import ChatBox from "../ChatBox";
import Feedback from "../Feedbacks";
import ProposalApprovals from "../ProjectProposals";
import SupervisorDepartments from "../DepartmentManagement";
import FYPProjects from "../FYPProjects";
import SupervisorTemplateManager from "../TemplateManager";
import ManageMeetings from "../ManageMeetings";
import MarkAttendance from "../MarkAttendance";
import PhaseEvaluation from "../PhaseEvaluation";
import MyPanel from "../MyPanel";
// import Students from "../Students";

// Icons
import { FaHome, FaTasks, FaUserGraduate, FaComments, FaSignOutAlt, FaBuilding, FaClipboardList, FaFolderOpen, FaCalendarPlus, FaCheckSquare, FaClipboardCheck, FaGavel } from "react-icons/fa";

const Main = ({ defaultModule = "Dashboard" }) => {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState(defaultModule);
  const [supervisorName, setSupervisorName] = useState("");

  useEffect(() => {
    const supervisorData = localStorage.getItem("supervisorData");
    if (supervisorData) {
      try {
        const parsed = JSON.parse(supervisorData);
        setSupervisorName(parsed.name || "");
      } catch (error) {
        console.error("❌ Failed to parse supervisor data from localStorage", error);
      }
    }
  }, []);

  const initials = supervisorName
    ? supervisorName.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "S";

  useEffect(() => {
    setActiveModule(defaultModule);
  }, [defaultModule]);

  const handleLogout = () => {
    localStorage.removeItem("supervisorData");   // remove user info
    localStorage.removeItem("token");  // remove token
    navigate("/");     // redirect to login
  };
  

  const ShowModule = (moduleName) => {
    setActiveModule(moduleName);
    // navigate(`/${moduleName}`);
  };

  return (
    <div className={styles.main_wrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebar_header}>
          <div className={styles.brand_icon}><FaFolderOpen /></div>
          <h2>Supervisor Panel</h2>
        </div>

        {/* <div className={styles.profile_card}>
          <div className={styles.profile_avatar}>{initials}</div>
          <div className={styles.profile_info}>
            <span className={styles.profile_name}>{supervisorName || "Supervisor"}</span>
            <span className={styles.profile_role}>Supervisor</span>
          </div>
        </div> */}

        <nav className={styles.sidebar_nav}>
          <button onClick={() => ShowModule("Dashboard")} className={activeModule === "Dashboard" ? styles.active : ""}>
            <FaHome /> Dashboard
          </button>

          <div className={styles.nav_section_label}>Workflow</div>
          <button onClick={() => ShowModule("proposal-approval")} className={activeModule === "proposal-approval" ? styles.active : ""}>
            <FaClipboardList /> Proposals
          </button>
          <button onClick={() => ShowModule("fyp-projects")} className={activeModule === "fyp-projects" ? styles.active : ""}>
            <FaFolderOpen /> FYP Projects
          </button>
          <button onClick={() => ShowModule("AllUserGroups")} className={activeModule === "AllUserGroups" ? styles.active : ""}>
            <FaUserGraduate /> Students
          </button>

          <div className={styles.nav_section_label}>Attendance</div>
          <button onClick={() => ShowModule("MarkAttendance")} className={activeModule === "MarkAttendance" ? styles.active : ""}>
            <FaCheckSquare /> Mark Attendance
          </button>
          <button onClick={() => ShowModule("ManageMeetings")} className={activeModule === "ManageMeetings" ? styles.active : ""}>
            <FaCalendarPlus /> Manage Meetings
          </button>

          <div className={styles.nav_section_label}>Evaluation</div>
          <button onClick={() => ShowModule("PhaseEvaluation")} className={activeModule === "PhaseEvaluation" ? styles.active : ""}>
            <FaClipboardCheck /> Phase Evaluation
          </button>
          <button onClick={() => ShowModule("MyPanel")} className={activeModule === "MyPanel" ? styles.active : ""}>
            <FaGavel /> My Panel
          </button>

          <div className={styles.nav_section_label}>Resources</div>
          <button
            onClick={() => ShowModule("DepartmentManagement")}
            className={activeModule === "DepartmentManagement" ? styles.active : ""}
          >
            <FaBuilding /> Departments
          </button>
          <button onClick={() => ShowModule("fyp-templates")} className={activeModule === "fyp-templates" ? styles.active : ""}>
            <FaFolderOpen /> Templates
          </button>
          <button onClick={() => ShowModule("ChatBox")} className={activeModule === "ChatBox" ? styles.active : ""}>
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
        {activeModule === "Dashboard" && <Dashboard setActiveModule={setActiveModule} />}
        {activeModule === "CreateProject" && <CreateProject />}
      {activeModule === "AssignProject" && <AssignProject />}
      {activeModule === "DepartmentManagement" && <SupervisorDepartments />}
      {activeModule === "proposal-approval" && <ProposalApprovals />}
      {activeModule === "fyp-projects"       && <FYPProjects />}
      {activeModule === "fyp-templates"     && <SupervisorTemplateManager />}
           {activeModule === "AllUserGroups" && <AllUserGroups />}
        {activeModule === "ManageMeetings" && <ManageMeetings />}
        {activeModule === "MarkAttendance" && <MarkAttendance />}
        {activeModule === "PhaseEvaluation" && <PhaseEvaluation />}
        {activeModule === "MyPanel" && <MyPanel />}
        {activeModule === "ChatBox" && <ChatBox />}
       {activeModule === "Feedback" && <Feedback />} 
      </main>
    </div>
  );
};

export default Main;
