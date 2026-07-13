import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import { useNavigate } from "react-router-dom";
import DeadlineBanner from "../DeadlineBanner";
import LivePreview from "../LivePreview";
import { resolveFileUrl } from "../../utils/resolveFileUrl";
import { generateCompletionCertificate } from "../../utils/certificateUtils";
import {
  FaProjectDiagram,
  FaClipboardList,
  FaCheckCircle,
  FaHourglassHalf,
  FaPlus,
  FaUserCheck,
  FaCalendarWeek,
  FaMarker,
  FaGithub,
  FaPlayCircle,
  FaEdit,
  FaAward,
} from "react-icons/fa";

const CreateTask = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null); // Track editing task
  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
    taskFile: null,
    taskCode: "",
    startDate: "",
    dueDate: "",
    priority: "Medium",
    projectId: "", // NEW field,
  });
  const [teams, setTeams] = useState([]);
  const [assignedProjectIds, setAssignedProjectIds] = useState([]);
  const [taskAssigneeMap, setTaskAssigneeMap] = useState({});
  const [allAssignments, setAllAssignments] = useState([]);
  const [groupProjects, setGroupProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportProjectId, setReportProjectId] = useState(null);
  const [reportFile, setReportFile] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [linksModalProject, setLinksModalProject] = useState(null);
  const [linksForm, setLinksForm] = useState({ githubRepository: "", deploymentLink: "" });
  const [linksSaving, setLinksSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [progressModalProject, setProgressModalProject] = useState(null);
  const [progressLogs, setProgressLogs] = useState([]);
  const [progressLogsLoading, setProgressLogsLoading] = useState(false);
  const [newLog, setNewLog] = useState({ workDone: "", plannedNext: "", challenges: "" });
  const [submittingLog, setSubmittingLog] = useState(false);

  const [reviewNotesModalProject, setReviewNotesModalProject] = useState(null);
  const [reviewNotes, setReviewNotes] = useState([]);
  const [reviewNotesLoading, setReviewNotesLoading] = useState(false);
  const [resolvingNoteId, setResolvingNoteId] = useState(null);

  const token = localStorage.getItem("token");
  const loggedInUser = JSON.parse(localStorage.getItem("user"));
  const userId = loggedInUser.id; // ✅ Get user ID
  const studentJoinCode = loggedInUser.studentJoinCode;
  const liveSelf = users.find((u) => String(u._id) === String(userId));
  const isTeamLeader = liveSelf
    ? String(liveSelf.designation || "").toLowerCase() === "teamleader"
    : String(loggedInUser?.designation || "").toLowerCase() === "teamleader";

  // Fetch users and tasks from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/users`);
        setUsers(response.data);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    const fetchAllData = async () => {
      try {
        // Fetch tasks and projects in parallel
       
        const [tasksRes, projectsRes, assignedRes, allAssignedRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/auth/tasks`),
          axios.get(`${process.env.REACT_APP_API_URL}/auth/student-project/${userId}`).catch(() => ({ data: [] })),
          axios.get(`${process.env.REACT_APP_API_URL}/auth/Myassigned-tasks?userId=${userId}`),
          axios.get(`${process.env.REACT_APP_API_URL}/auth/Otherassigned-tasks?userId=${userId}`),
        ]);

        const projects = projectsRes.data;

        // Show every task belonging to a project this student is part of
        // (as leader or member), not just tasks this student personally created.
        const myProjectIds = new Set(projects.map((p) => String(p._id)));
        const tasks = tasksRes.data.filter((t) => myProjectIds.has(String(t.projectId)));
        const assignedTogether = Array.isArray(assignedRes.data)
          ? assignedRes.data
              .map((assignment) => String(assignment.project || assignment.projectId))
              .filter(Boolean)
          : [];

        const taskAssigneeMapValue = Array.isArray(allAssignedRes.data)
          ? allAssignedRes.data.reduce((map, assignment) => {
              const taskId = String(assignment.project || assignment.projectId);
              if (taskId) {
                map[taskId] = assignment.user || map[taskId] || "Unknown";
              }
              return map;
            }, {})
          : {};

        setAssignedProjectIds(assignedTogether);
        setTaskAssigneeMap(taskAssigneeMapValue);
        setAllAssignments(Array.isArray(allAssignedRes.data) ? allAssignedRes.data : []);
        console.log("task data >>>>>>>",taskAssigneeMapValue);
        // console.log("projects>>>>>", projects);
        setProjects(projects); // store original projects if needed elsewhere

        // Create projectId → projectTitle map
        const projectMap = {};
        projects.forEach((project) => {
          projectMap[project._id] = project.title;
        });

        // Merge project title into each task
        const mergedTasks = tasks.map((task) => ({
          ...task,
          projectName: projectMap[task.projectId] || "Unknown Project",
        }));

        setTasks(mergedTasks);
        console.log("task>>>>", mergedTasks);
      } catch (error) {
        console.error("Error fetching tasks or projects:", error);
      }
    };

    // Edit Task handler (can move outside useEffect if used in JSX)
    const handleEdit = (task) => {
      setTaskData({ ...task, taskFile: null }); // Avoid file upload issues
      setEditingTaskId(task._id);
    };
    const init = async () => {
      await fetchUsers();
      await fetchAllData();
    };
    init();
  }, []);

  useEffect(() => {
    setGroupProjects(projects);
  }, [projects]);

  // Handle Input Change
  const handleChange = (e) => {
    const { name, value, type, files } = e.target;

    // Check if it's a file input
    if (type === "file") {
      setTaskData({ ...taskData, [name]: files[0] });
    } else {
      setTaskData({ ...taskData, [name]: value });
    }
  };

  // Handle Form Submission
  // const handleSubmit = async (e) => {
  //   e.preventDefault();

  //   if (!isTeamLeader) {
  //     setMessage("Only the team leader can create tasks.");
  //     return;
  //   }

  //   setLoading(true);

  //   const formData = new FormData();
  //   formData.append("title", taskData.title);
  //   formData.append("description", taskData.description);
  //   if (taskData.taskFile) {
  //     formData.append("taskFile", taskData.taskFile);
  //   }
  //   formData.append("taskCode", taskData.taskCode);
  //   formData.append("startDate", taskData.startDate);
  //   formData.append("dueDate", taskData.dueDate);
  //   formData.append("priority", taskData.priority);
  //   formData.append("projectId", taskData.projectId);

  //   try {
  //     const response = await axios.post(
  //       `${process.env.REACT_APP_API_URL}/auth/task`,
  //       formData,
  //       {
  //         headers: { "Content-Type": "multipart/form-data" },
  //       }
  //     );

  //     const newTask = response.data.task || response.data;

  //     // ✅ Ensure correct data structure before updating the state
  //     const formattedTask = {
  //       ...newTask,
  //       startDate: newTask.startDate ? newTask.startDate.split("T")[0] : "N/A",
  //       dueDate: newTask.dueDate ? newTask.dueDate.split("T")[0] : "N/A",
  //     };

  //     setMessage("✅ Task Created Successfully!");

  //     // ✅ Update the tasks state immediately
  //     setTasks((prevTasks) => [...prevTasks, formattedTask]);

  //     // Reset form
  //     setTaskData({
  //       title: "",
  //       description: "",
  //       taskFile: null,
  //       taskCode: "",
  //       startDate: "",
  //       dueDate: "",
  //       priority: "Medium",
  //       projectId: "", // NEW field
  //     });
  //   } catch (error) {
  //     setMessage("❌ Error creating task. Please try again.");
  //     console.error("Task creation error:", error);
  //   } finally {
  //     setLoading(false);
  //     setTimeout(() => setMessage(""), 3000);
  //   }
  // };


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isTeamLeader) {
      setMessage("Only the team leader can create tasks.");
      return;
    }

    if (!taskData.projectId) {
      setMessage("❌ Please select a project for this task.");
      return;
    }

    if (!userId) {
      setMessage("❌ Session error — please log out and log in again.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("title", taskData.title);
    formData.append("description", taskData.description);
    if (taskData.taskFile) formData.append("taskFile", taskData.taskFile);
    formData.append("taskCode", taskData.taskCode);
    formData.append("startDate", taskData.startDate);
    formData.append("dueDate", taskData.dueDate);
    formData.append("priority", taskData.priority || "Medium");
    formData.append("projectId", taskData.projectId);
    formData.append("createdBy", userId);
    if (studentJoinCode) formData.append("studentJoinCode", studentJoinCode);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/auth/task`,
        formData
        // axios sets Content-Type: multipart/form-data with the correct boundary automatically
      );

      const newTask = response.data.task || response.data;
      const projectName = groupProjects.find((p) => String(p._id) === String(taskData.projectId))?.title || "Unknown Project";

      const formattedTask = {
        ...newTask,
        projectName,
        startDate: newTask.startDate ? newTask.startDate.split("T")[0] : "N/A",
        dueDate: newTask.dueDate ? newTask.dueDate.split("T")[0] : "N/A",
      };

      setMessage("✅ Task Created Successfully!");
      setTasks((prevTasks) => [...prevTasks, formattedTask]);
      setShowModal(false);
      setTaskData({ title: "", description: "", taskFile: null, taskCode: "", startDate: "", dueDate: "", priority: "Medium", projectId: "" });
    } catch (error) {
      const msg = error.response?.data?.message || "Error creating task. Please try again.";
      setMessage(`❌ ${msg}`);
      console.error("Task creation error:", error.response?.data || error);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  // Edit Task
  const handleEdit = (task) => {
    setTaskData(task);
    setEditingTaskId(task._id);
  };

  // Update Task
  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.put(
`${process.env.REACT_APP_API_URL}/auth/task/${editingTaskId}`,
        taskData
      );
      setMessage("✅ Task Updated Successfully!");
      setTasks(
        tasks.map((task) =>
          task._id === editingTaskId ? response.data.task : task
        )
      );
      setEditingTaskId(null); // Reset edit mode
      setTaskData({
        title: "",
        description: "",
        taskCode: "",
        startDate: "",
        dueDate: "",
        priority: "Medium",
      });
    } catch (error) {
      console.error("Update Error:", error);
      setMessage("❌ Error updating task.");
    }
  };
  const handleOpenModal = (preselectedProjectId = "") => {
    if (!isTeamLeader) {
      setMessage("Only the team leader can create tasks.");
      return;
    }
    if (preselectedProjectId) {
      setTaskData((prev) => ({ ...prev, projectId: preselectedProjectId }));
    }
    setEditingTaskId(null);
    setShowModal(true);
  };
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTaskId(null);
    setTaskData({
      title: "", description: "", taskFile: null, taskCode: "",
      startDate: "", dueDate: "", priority: "Medium", projectId: "",
    });
  };

  const handleAssign = (task) => {
    if (!isTeamLeader) {
      setMessage("Only the team leader can assign tasks.");
      return;
    }
    navigate("/student/Assign-task", { state: { task } });
  };

  // Delete Task
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/auth/task/${id}`);
      setMessage("🗑 Task Deleted Successfully!");
      setTasks(tasks.filter((task) => task._id !== id));
    } catch (error) {
      console.error("Delete Error:", error);
      setMessage("❌ Error deleting task.");
    }
  };

  const handleOpenLinksModal = (project) => {
    if (!isTeamLeader) {
      setMessage("Only the team leader can update project links.");
      return;
    }
    setLinksForm({
      githubRepository: project.githubRepository || "",
      deploymentLink: project.deploymentLink || "",
    });
    setLinksModalProject(project);
  };

  const handleSaveLinks = async () => {
    if (!linksForm.githubRepository.trim()) {
      alert("GitHub repository link is required.");
      return;
    }
    setLinksSaving(true);
    try {
      const res = await axios.put(
        `${process.env.REACT_APP_API_URL}/auth/projects/${linksModalProject._id}/details`,
        {
          githubRepository: linksForm.githubRepository.trim(),
          deploymentLink: linksForm.deploymentLink.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updated = res.data.project;
      setGroupProjects((prev) =>
        prev.map((p) => (p._id === linksModalProject._id ? { ...p, ...updated } : p))
      );
      setMessage("✅ Project links saved!");
      setLinksModalProject(null);
    } catch (err) {
      console.error("Error saving project links:", err);
      alert(err.response?.data?.message || "Failed to save project links.");
    } finally {
      setLinksSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const fetchProgressLogs = async (projectId) => {
    setProgressLogsLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/progress-logs/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProgressLogs(res.data.logs || []);
    } catch (err) {
      console.error("Error fetching progress logs:", err);
      setProgressLogs([]);
    } finally {
      setProgressLogsLoading(false);
    }
  };

  const handleOpenProgressModal = (project) => {
    setProgressModalProject(project);
    setNewLog({ workDone: "", plannedNext: "", challenges: "" });
    fetchProgressLogs(project._id);
  };

  const nextWeekNumber = progressLogs.length
    ? Math.max(...progressLogs.map((l) => l.weekNumber)) + 1
    : 1;

  const handleSubmitProgressLog = async () => {
    if (!isTeamLeader) {
      setMessage("Only the team leader can submit progress logs.");
      return;
    }
    if (!newLog.workDone.trim()) {
      alert("Please describe the work done this week.");
      return;
    }
    setSubmittingLog(true);
    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/auth/progress-logs`,
        {
          projectId: progressModalProject._id,
          weekNumber: nextWeekNumber,
          workDone: newLog.workDone.trim(),
          plannedNext: newLog.plannedNext.trim(),
          challenges: newLog.challenges.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewLog({ workDone: "", plannedNext: "", challenges: "" });
      fetchProgressLogs(progressModalProject._id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to submit progress log.");
    } finally {
      setSubmittingLog(false);
    }
  };

  const fetchReviewNotes = async (projectId) => {
    setReviewNotesLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/review-notes/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReviewNotes(res.data.reviewNotes || []);
    } catch (err) {
      console.error("Error fetching review notes:", err);
      setReviewNotes([]);
    } finally {
      setReviewNotesLoading(false);
    }
  };

  const handleOpenReviewNotesModal = (project) => {
    setReviewNotesModalProject(project);
    fetchReviewNotes(project._id);
  };

  const handleResolveNote = async (noteId) => {
    if (!isTeamLeader) {
      setMessage("Only the team leader can mark a review note as resolved.");
      return;
    }
    setResolvingNoteId(noteId);
    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL}/auth/review-notes/${noteId}/resolve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchReviewNotes(reviewNotesModalProject._id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to mark review note as resolved.");
    } finally {
      setResolvingNoteId(null);
    }
  };

  const handleOpenReportModal = (projectId) => {
    if (!isTeamLeader) {
      setMessage("Only the team leader can submit the final report.");
      return;
    }

    const targetProject = groupProjects.find((p) => String(p._id) === String(projectId));
    if (!targetProject?.githubRepository) {
      setMessage("Please add your GitHub repository link (in Project Links) before submitting the final report.");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    // Get all tasks for this project
    const projectTasks = tasks.filter(
      (t) => String(t.projectId) === String(projectId)
    );

    // Block if any task is not yet assigned
    const unassigned = projectTasks.filter((t) => !t.isAssigned);
    if (unassigned.length > 0) {
      setMessage(
        `Cannot submit: ${unassigned.length} task(s) are not yet assigned to team members. Assign all tasks first.`
      );
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    // Block if any assignment for this project's tasks is still Pending or In Progress
    const projectTaskIds = new Set(projectTasks.map((t) => String(t._id)));
    const incompleteTasks = allAssignments.filter(
      (a) =>
        projectTaskIds.has(String(a.project || a.taskId)) &&
        (a.status === "Pending" || a.status === "In Progress")
    );
    if (incompleteTasks.length > 0) {
      setMessage(
        `Cannot submit: ${incompleteTasks.length} task(s) are still pending completion by team members.`
      );
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    setReportProjectId(projectId);
    setReportFile(null);
    setShowReportModal(true);
  };

  const handleSubmitFinalReport = async () => {
    if (!reportFile) {
      alert("Please select a PDF file.");
      return;
    }
    setReportSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("finalReport", reportFile);
      await axios.put(
        `${process.env.REACT_APP_API_URL}/auth/projects/${reportProjectId}/final-report`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      alert("Final report submitted! Project is now under review by your supervisor.");
      setShowReportModal(false);
      setGroupProjects((prev) =>
        prev.map((p) =>
          p._id === reportProjectId ? { ...p, status: "UNDER_REVIEW" } : p
        )
      );
    } catch (err) {
      console.error("Final report submission error:", err);
      alert(err.response?.data?.message || "Submission failed. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleSubmitProject = async (projectId, groupId) => {
    if (!isTeamLeader) {
      setMessage("Only the team leader can submit the project.");
      return;
    }
    try {
      const normalizedProjectId = projectId?._id || projectId;
      const normalizedGroupId = groupId?._id || groupId;

      console.log("groupProjects", groupProjects);
      console.log("projectId>>>", normalizedProjectId);
      console.log("groupId>>>", normalizedGroupId);

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/auth/sub-project`,
        { projectId: normalizedProjectId, groupId: normalizedGroupId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Project submitted successfully!");
      console.log(response.data);
      // Update the project status in groupProjects or relevantAssignments
      setGroupProjects((prevProjects) =>
        prevProjects.map((project) =>
          project.projectId === projectId
            ? { ...project, status: "pending" }
            : project
        )
      );
    } catch (err) {
      console.error("Submit failed", err);
      alert("Submit failed – check console.");
    }
  };

  const taskStats = useMemo(
    () => ({
      totalProjects: groupProjects.length,
      totalTasks: tasks.length,
      assigned: tasks.filter((t) => t.isAssigned).length,
      unassigned: tasks.filter((t) => !t.isAssigned).length,
    }),
    [groupProjects, tasks]
  );

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaProjectDiagram /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Project &amp; Task Manager</h2>
          <p className={styles.subheading}>Track your project's progress, manage tasks, and submit your final report.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#dbeafe", color: "#1e40af" }}>
            <FaProjectDiagram />
          </div>
          <div>
            <h4>Projects</h4>
            <p>{taskStats.totalProjects}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#fef3c7", color: "#92400e" }}>
            <FaClipboardList />
          </div>
          <div>
            <h4>Total Tasks</h4>
            <p>{taskStats.totalTasks}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#dcfce7", color: "#15803d" }}>
            <FaCheckCircle />
          </div>
          <div>
            <h4>Assigned</h4>
            <p>{taskStats.assigned}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#fee2e2", color: "#b91c1c" }}>
            <FaHourglassHalf />
          </div>
          <div>
            <h4>Unassigned</h4>
            <p>{taskStats.unassigned}</p>
          </div>
        </div>
      </div>

      <DeadlineBanner type="final" tokenKey="token" />

      {message && (
        <p
          className={`${styles.message} ${
            message.includes("Error") ? styles.error : styles.success
          }`}
        >
          {message}
        </p>
      )}

      {/* Action Buttons */}
      <div className={styles.actionRow}>
        <button onClick={handleOpenModal} className={styles.addTaskBtn}>
          <FaPlus /> Add Task
        </button>

        {isTeamLeader && (
          <button
            onClick={() => navigate("/student/Assign-task")}
            className={styles.assignTaskBtn}
          >
            <FaUserCheck /> Assign Task
          </button>
        )}
      </div>
      {!isTeamLeader && (
        <p className={styles.leaderNotice}>
          Only team leaders can create tasks, assign group members, and submit projects.
        </p>
      )}

      {/* Project Links Modal */}
      {linksModalProject && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <span className={styles.closeButton} onClick={() => setLinksModalProject(null)}>❌</span>
            <h2 className={styles.card_heading}>Project Links</h2>
            <p style={{ color: "#555", marginTop: "8px" }}>
              {linksModalProject.title}
            </p>

            <div style={{ marginTop: "16px" }}>
              <label style={{ fontWeight: "600", display: "block", marginBottom: "6px" }}>
                GitHub Repository <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="https://github.com/your-team/your-repo"
                value={linksForm.githubRepository}
                onChange={(e) => setLinksForm((f) => ({ ...f, githubRepository: e.target.value }))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }}
              />
              <p style={{ marginTop: "4px", color: "#9ca3af", fontSize: "12px" }}>
                Required — you cannot submit your final report without this.
              </p>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={{ fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Live Deployment Link (optional)
              </label>
              <input
                type="text"
                placeholder="https://your-project.vercel.app"
                value={linksForm.deploymentLink}
                onChange={(e) => setLinksForm((f) => ({ ...f, deploymentLink: e.target.value }))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }}
              />
              <p style={{ marginTop: "4px", color: "#9ca3af", fontSize: "12px" }}>
                If you've deployed your project live, share the link so your supervisor and admin can preview it without leaving the platform.
              </p>
              {linksForm.deploymentLink.trim() && (
                <button
                  type="button"
                  onClick={() => setPreviewUrl(linksForm.deploymentLink.trim())}
                  style={{ marginTop: "8px", background: "none", border: "1px solid #2563eb", color: "#2563eb", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                >
                  👁 Preview before saving
                </button>
              )}
            </div>

            <button
              className={styles.button}
              onClick={handleSaveLinks}
              disabled={linksSaving}
              style={{ marginTop: "20px" }}
            >
              {linksSaving ? "Saving..." : "Save Links"}
            </button>
          </div>
        </div>
      )}

      {previewUrl && (
        <LivePreview url={previewUrl} title="Live Preview" onClose={() => setPreviewUrl(null)} />
      )}

      {/* Final Report Submission Modal */}
      {showReportModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <span className={styles.closeButton} onClick={() => setShowReportModal(false)}>❌</span>
            <h2 className={styles.card_heading}>Submit Final Report</h2>
            <p style={{ color: "#555", marginTop: "8px" }}>
              Upload your final FYP report as a PDF (max 20MB). Once submitted, your supervisor will review it.
            </p>
            <div style={{ marginTop: "16px" }}>
              <label style={{ fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Select PDF File:
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setReportFile(e.target.files[0])}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px" }}
              />
              {reportFile && (
                <p style={{ marginTop: "8px", color: "#374151", fontSize: "13px" }}>
                  Selected: {reportFile.name} ({(reportFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
            <button
              className={styles.button}
              onClick={handleSubmitFinalReport}
              disabled={reportSubmitting || !reportFile}
              style={{ marginTop: "20px" }}
            >
              {reportSubmitting ? "Submitting..." : "Submit Final Report"}
            </button>
          </div>
        </div>
      )}

      {/* Weekly Progress Log Modal */}
      {progressModalProject && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: "640px" }}>
            <span className={styles.closeButton} onClick={() => setProgressModalProject(null)}>❌</span>
            <h2 className={styles.card_heading}>Weekly Progress Updates</h2>
            <p style={{ color: "#555", marginTop: "8px" }}>{progressModalProject.title}</p>

            <div style={{ marginTop: "18px", maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
              {progressLogsLoading ? (
                <p style={{ color: "#9ca3af", fontSize: "13px" }}>Loading logs...</p>
              ) : progressLogs.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: "13px" }}>No weekly updates submitted yet.</p>
              ) : (
                progressLogs.map((log) => (
                  <div key={log._id} style={{ background: "#f8fafc", borderRadius: "10px", padding: "12px 14px", border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "13.5px", color: "#111827" }}>Week {log.weekNumber}</strong>
                      <span style={{
                        fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px",
                        background: log.status === "REVIEWED" ? "#dcfce7" : "#fef3c7",
                        color: log.status === "REVIEWED" ? "#15803d" : "#92400e",
                      }}>
                        {log.status === "REVIEWED" ? "Reviewed" : "Pending Review"}
                      </span>
                    </div>
                    <p style={{ fontSize: "13px", color: "#374151", margin: "4px 0" }}><strong>Work done:</strong> {log.workDone}</p>
                    {log.plannedNext && (
                      <p style={{ fontSize: "13px", color: "#374151", margin: "4px 0" }}><strong>Planned next:</strong> {log.plannedNext}</p>
                    )}
                    {log.challenges && (
                      <p style={{ fontSize: "13px", color: "#374151", margin: "4px 0" }}><strong>Challenges:</strong> {log.challenges}</p>
                    )}
                    {log.supervisorFeedback && (
                      <div style={{ marginTop: "8px", background: "#eff6ff", borderLeft: "3px solid #2563eb", borderRadius: "6px", padding: "8px 10px" }}>
                        <strong style={{ fontSize: "12px", color: "#1e40af" }}>Supervisor feedback:</strong>
                        <p style={{ fontSize: "12.5px", color: "#1e3a8a", margin: "2px 0 0" }}>{log.supervisorFeedback}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {isTeamLeader ? (
              <div style={{ marginTop: "18px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#1f2937", margin: "0 0 10px" }}>
                  Submit Week {nextWeekNumber} Update
                </h3>
                <label style={{ fontWeight: "600", fontSize: "12.5px", display: "block", marginBottom: "4px" }}>Work done this week *</label>
                <textarea
                  value={newLog.workDone}
                  onChange={(e) => setNewLog((f) => ({ ...f, workDone: e.target.value }))}
                  style={{ width: "100%", minHeight: "60px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "8px", boxSizing: "border-box", fontSize: "13px", fontFamily: "inherit" }}
                />
                <label style={{ fontWeight: "600", fontSize: "12.5px", display: "block", marginTop: "10px", marginBottom: "4px" }}>Planned for next week</label>
                <textarea
                  value={newLog.plannedNext}
                  onChange={(e) => setNewLog((f) => ({ ...f, plannedNext: e.target.value }))}
                  style={{ width: "100%", minHeight: "50px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "8px", boxSizing: "border-box", fontSize: "13px", fontFamily: "inherit" }}
                />
                <label style={{ fontWeight: "600", fontSize: "12.5px", display: "block", marginTop: "10px", marginBottom: "4px" }}>Challenges (optional)</label>
                <textarea
                  value={newLog.challenges}
                  onChange={(e) => setNewLog((f) => ({ ...f, challenges: e.target.value }))}
                  style={{ width: "100%", minHeight: "50px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "8px", boxSizing: "border-box", fontSize: "13px", fontFamily: "inherit" }}
                />
                <button
                  className={styles.button}
                  onClick={handleSubmitProgressLog}
                  disabled={submittingLog}
                  style={{ marginTop: "14px" }}
                >
                  {submittingLog ? "Submitting..." : `Submit Week ${nextWeekNumber} Update`}
                </button>
              </div>
            ) : (
              <p style={{ marginTop: "16px", color: "#9ca3af", fontSize: "12.5px", borderTop: "1px solid #e5e7eb", paddingTop: "14px" }}>
                Only the team leader can submit weekly updates.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Live Review Notes Modal */}
      {reviewNotesModalProject && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: "680px" }}>
            <span className={styles.closeButton} onClick={() => setReviewNotesModalProject(null)}>❌</span>
            <h2 className={styles.card_heading}>Live Review Notes</h2>
            <p style={{ color: "#555", marginTop: "8px" }}>{reviewNotesModalProject.title}</p>

            <div style={{ marginTop: "16px", maxHeight: "480px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              {reviewNotesLoading ? (
                <p style={{ color: "#9ca3af", fontSize: "13px" }}>Loading review notes...</p>
              ) : reviewNotes.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: "13px" }}>
                  Your supervisor hasn't marked any issues on the live preview yet.
                </p>
              ) : (
                reviewNotes.map((rn) => (
                  <div key={rn._id} style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px", border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <strong style={{ fontSize: "13px", color: "#111827" }}>
                        {new Date(rn.createdAt).toLocaleDateString()} — {rn.supervisorId?.name || "Supervisor"}
                        {" "}({(rn.items || []).length} screenshot{(rn.items || []).length !== 1 ? "s" : ""})
                      </strong>
                      <span style={{
                        fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px",
                        background: rn.status === "RESOLVED" ? "#dcfce7" : "#fee2e2",
                        color: rn.status === "RESOLVED" ? "#15803d" : "#b91c1c",
                      }}>
                        {rn.status === "RESOLVED" ? "Resolved" : "Open"}
                      </span>
                    </div>

                    {rn.remarks && (
                      <div style={{ marginBottom: "12px", background: "#eff6ff", borderLeft: "3px solid #2563eb", borderRadius: "6px", padding: "8px 10px" }}>
                        <strong style={{ fontSize: "12px", color: "#1e40af" }}>Supervisor's remarks:</strong>
                        <p style={{ fontSize: "12.5px", color: "#1e3a8a", margin: "2px 0 0" }}>{rn.remarks}</p>
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {(rn.items || []).map((item, itemIdx) => (
                        <div key={itemIdx}>
                          <div style={{ position: "relative", width: "100%", borderRadius: "8px", overflow: "hidden", background: "#0b141a" }}>
                            <img
                              src={resolveFileUrl(item.screenshotUrl)}
                              alt={`Supervisor review screenshot ${itemIdx + 1}`}
                              style={{ width: "100%", display: "block" }}
                            />
                            {(item.annotations || []).map((pin, i) => (
                              <div
                                key={i}
                                style={{
                                  position: "absolute", left: `${pin.x}%`, top: `${pin.y}%`,
                                  transform: "translate(-50%, -50%)", width: "22px", height: "22px",
                                  borderRadius: "50%", background: "#ef4444", color: "white",
                                  fontSize: "11px", fontWeight: "800", display: "flex",
                                  alignItems: "center", justifyContent: "center",
                                  boxShadow: "0 0 0 3px rgba(255,255,255,0.85)",
                                }}
                              >
                                {i + 1}
                              </div>
                            ))}
                          </div>

                          {(item.annotations || []).length > 0 && (
                            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                              {item.annotations.map((pin, i) => (
                                <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                  <span style={{
                                    flexShrink: 0, width: "20px", height: "20px", borderRadius: "50%",
                                    background: "#ef4444", color: "white", fontSize: "10.5px", fontWeight: "800",
                                    display: "flex", alignItems: "center", justifyContent: "center", marginTop: "1px",
                                  }}>
                                    {i + 1}
                                  </span>
                                  <p style={{ fontSize: "13px", color: "#374151", margin: 0 }}>{pin.text}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {rn.status === "OPEN" && isTeamLeader && (
                      <button
                        onClick={() => handleResolveNote(rn._id)}
                        disabled={resolvingNoteId === rn._id}
                        style={{
                          marginTop: "12px", display: "flex", alignItems: "center", gap: "6px",
                          background: "#16a34a", color: "white", border: "none", borderRadius: "8px",
                          padding: "8px 14px", fontSize: "12.5px", fontWeight: "700", cursor: "pointer",
                        }}
                      >
                        ✅ {resolvingNoteId === rn._id ? "Marking..." : "Mark as Resolved"}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <span className={styles.closeButton} onClick={handleCloseModal}>
              ❌
            </span>
            <h2 className={styles.card_heading}>
              {editingTaskId ? "🔄 Update Task" : "🆕 Create New Task"}
            </h2>
            <form
              className={styles.task_form}
              onSubmit={editingTaskId ? handleUpdate : handleSubmit}
            >
              <label htmlFor="projectId">Project:</label>
              <select
                name="projectId"
                value={taskData.projectId}
                onChange={handleChange}
                required
              >
                <option value="">-- Select a Project --</option>
                {groupProjects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.title}
                  </option>
                ))}
              </select>

              <label htmlFor="title">Title:</label>
              <input
                type="text"
                name="title"
                placeholder="Task Title"
                value={taskData.title}
                onChange={handleChange}
                required
              />

              <label htmlFor="description">Description:</label>
              <textarea
                name="description"
                placeholder="Task Description"
                value={taskData.description}
                onChange={handleChange}
                required
              ></textarea>

              <label htmlFor="taskFile">Task File (optional):</label>
              <input
                type="file"
                name="taskFile"
                onChange={handleChange}
              />

              <label htmlFor="taskCode">Task Code:</label>
              <input
                type="text"
                name="taskCode"
                placeholder="Task Code"
                value={taskData.taskCode}
                onChange={handleChange}
                required
              />

              <label htmlFor="startDate">Start Date:</label>
              <input
                type="date"
                name="startDate"
                value={taskData.startDate}
                onChange={handleChange}
                required
              />

              <label htmlFor="dueDate">Due Date:</label>
              <input
                type="date"
                name="dueDate"
                value={taskData.dueDate}
                onChange={handleChange}
                required
              />

              <label htmlFor="priority">Priority:</label>
              <select
                name="priority"
                value={taskData.priority}
                onChange={handleChange}
              >
                <option value="Low">🟢 Low Priority</option>
                <option value="Medium">🟡 Medium Priority</option>
                <option value="High">🔴 High Priority</option>
              </select>

              <button
                type="submit"
                className={styles.button}
                disabled={loading}
              >
                {loading
                  ? "⏳ Processing..."
                  : editingTaskId
                  ? "🔄 Update Task"
                  : "✅ Create Task"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Project List Table */}
      <div className={styles.card}>
        <h2 className={styles.table_heading}>
          My Projects
        </h2>
        <table className={styles.task_table}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Supervisor</th>
              <th>Team</th>
              <th>Progress</th>
              <th>Start Date</th>
              <th>Status</th>
              <th>Links</th>
              <th>Weekly Updates</th>
              <th>Live Review</th>
              <th>Your Grade</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupProjects.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ textAlign: "center", color: "#888" }}>
                  No projects found.
                </td>
              </tr>
            ) : (
              groupProjects.map((project) => {
                const rowKey = project._id;
                return (
                  <tr key={rowKey}>
                    <td>{project.title || "N/A"}</td>
                    <td>{project.category || "N/A"}</td>
                    <td>{project.supervisorId?.name || "N/A"}</td>
                    <td>{project.teamId?.subject || "N/A"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ flex: 1, height: "8px", background: "#e0e0e0", borderRadius: "4px", overflow: "hidden", minWidth: "70px" }}>
                          <div style={{ width: `${project.progress || 0}%`, height: "100%", background: "#4caf50", borderRadius: "4px" }} />
                        </div>
                        <span style={{ fontSize: "12px" }}>{project.progress || 0}%</span>
                      </div>
                    </td>
                    <td>{project.startDate ? new Date(project.startDate).toLocaleDateString() : "N/A"}</td>
                    <td>
                      <span style={{
                        padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600",
                        background: project.status === "COMPLETED" ? "#e8f5e9" : project.status === "IN_PROGRESS" ? "#e3f2fd" : project.status === "ON_HOLD" ? "#fff3e0" : project.status === "UNDER_REVIEW" ? "#f3e5f5" : project.status === "CANCELLED" ? "#fce4ec" : "#f3f4f6",
                        color: project.status === "COMPLETED" ? "#2e7d32" : project.status === "IN_PROGRESS" ? "#1565c0" : project.status === "ON_HOLD" ? "#e65100" : project.status === "UNDER_REVIEW" ? "#6a1b9a" : project.status === "CANCELLED" ? "#c62828" : "#374151",
                      }}>
                        {project.status || "ACTIVE"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {!project.deploymentLink && (
                          <span style={{ fontSize: "11px", color: "#9ca3af" }}>Live link not shared</span>
                        )}
                        <div style={{ display: "flex", gap: "5px" }}>
                          {project.githubRepository ? (
                            <a
                              href={project.githubRepository}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View GitHub Repo"
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                width: "28px", height: "28px", background: "#f3f4f6", border: "1px solid #e5e7eb",
                                color: "#1f2937", borderRadius: "7px", fontSize: "13px", textDecoration: "none",
                              }}
                            >
                              <FaGithub />
                            </a>
                          ) : (
                            <span
                              title="No GitHub repo linked yet"
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                width: "28px", height: "28px", background: "#f3f4f6", border: "1px solid #e5e7eb",
                                color: "#d1d5db", borderRadius: "7px", fontSize: "13px",
                              }}
                            >
                              <FaGithub />
                            </span>
                          )}
                          {project.deploymentLink && (
                            <button
                              type="button"
                              onClick={() => setPreviewUrl(project.deploymentLink)}
                              title="View Live"
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                width: "28px", height: "28px", background: "#dbeafe", border: "1px solid #93c5fd",
                                color: "#1e40af", borderRadius: "7px", fontSize: "13px", cursor: "pointer",
                              }}
                            >
                              <FaPlayCircle />
                            </button>
                          )}
                          {isTeamLeader && !["COMPLETED", "CANCELLED"].includes(project.status) && (
                            <button
                              type="button"
                              onClick={() => handleOpenLinksModal(project)}
                              title="Edit Links"
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                width: "28px", height: "28px", background: "#ede9fe", border: "1px solid #ddd6fe",
                                color: "#6d28d9", borderRadius: "7px", fontSize: "13px", cursor: "pointer",
                              }}
                            >
                              <FaEdit />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleOpenProgressModal(project)}
                        style={{
                          display: "flex", alignItems: "center", gap: "6px",
                          background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe",
                          borderRadius: "8px", padding: "6px 12px", fontSize: "12.5px", fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        <FaCalendarWeek /> Weekly Updates
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleOpenReviewNotesModal(project)}
                        style={{
                          display: "flex", alignItems: "center", gap: "6px",
                          background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a",
                          borderRadius: "8px", padding: "6px 12px", fontSize: "12.5px", fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        <FaMarker /> Review Notes
                      </button>
                    </td>
                    <td>
                      {(() => {
                        if (project.status !== "COMPLETED") return <span style={{ color: "#9ca3af", fontSize: "12px" }}>—</span>;
                        if (project.gradesStatus === "RELEASED") {
                          const myGrade = project.memberGrades?.find(g => String(g.userId) === String(userId));
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                              {myGrade ? (
                                <span style={{ fontWeight: "700", fontSize: "15px", color: "#2e7d32" }}>
                                  {myGrade.marks}<span style={{ fontWeight: "400", fontSize: "11px", color: "#6b7280" }}>/100</span>
                                </span>
                              ) : (
                                <span style={{ color: "#2e7d32", fontWeight: "600", fontSize: "13px" }}>
                                  {project.evaluationMarks ?? "—"}/100
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => generateCompletionCertificate(project)}
                                style={{
                                  display: "flex", alignItems: "center", gap: "5px",
                                  background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe",
                                  borderRadius: "6px", padding: "4px 9px", fontSize: "11px", fontWeight: "700",
                                  cursor: "pointer",
                                }}
                              >
                                <FaAward /> Certificate
                              </button>
                            </div>
                          );
                        }
                        if (project.gradesStatus === "PENDING_RELEASE") {
                          return <span style={{ color: "#d97706", fontSize: "12px", fontWeight: "600" }}>Pending Release</span>;
                        }
                        if (project.gradesStatus === "FLAGGED") {
                          return <span style={{ color: "#dc2626", fontSize: "12px", fontWeight: "600" }}>Under Review</span>;
                        }
                        return <span style={{ color: "#9ca3af", fontSize: "12px" }}>—</span>;
                      })()}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {isTeamLeader && !["COMPLETED", "CANCELLED", "UNDER_REVIEW"].includes(project.status) && (
                          <button
                            onClick={() => handleOpenModal(project._id)}
                            style={{
                              display: "flex", alignItems: "center", gap: "5px",
                              padding: "5px 10px", background: "#eff6ff", color: "#1e40af",
                              border: "1px solid #bfdbfe", borderRadius: "6px", cursor: "pointer",
                              fontSize: "12px", fontWeight: "600",
                            }}
                          >
                            <FaPlus style={{ fontSize: "10px" }} /> Add Task
                          </button>
                        )}
                        {isTeamLeader && ["ACTIVE", "IN_PROGRESS"].includes(project.status) ? (
                          <button
                            onClick={() => handleOpenReportModal(project._id)}
                            style={{
                              padding: "5px 10px", background: "#7c3aed", color: "white",
                              border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600",
                            }}
                          >
                            Submit Report
                          </button>
                        ) : project.status === "UNDER_REVIEW" ? (
                          <span style={{ color: "#6a1b9a", fontSize: "12px", fontWeight: "600" }}>Under Review</span>
                        ) : project.status === "COMPLETED" ? (
                          <span style={{ color: "#2e7d32", fontSize: "12px", fontWeight: "600" }}>Completed</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <h3 className={styles.sectionDivider}>Task Manager</h3>

      {/* Task List Table */}
      <div className={styles.card}>
        <h2 className={styles.table_heading}>📋 Task List</h2>
        <table className={styles.task_table}>
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Task Title</th>
              {/* <th>Description</th> */}
              {/* <th>Task File</th> */}
              <th>Task Code</th>
              <th>Start Date</th>
              <th>Due Date</th>
              <th>Priority</th>
              <th>{isTeamLeader ? "Actions" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task._id}>
                <td>{task?.projectName || "N/A"}</td>

                <td>{task.title}</td>
                {/* <td>{task.description}</td> */}
                {/* <td>{task.taskFile ? "📂 File Uploaded" : "No File"}</td> */}
                <td>{task.taskCode}</td>
                <td>{task.startDate ? task.startDate.split("T")[0] : "N/A"}</td>
                <td>{task.dueDate ? task.dueDate.split("T")[0] : "N/A"}</td>
                <td>
                  <span
                    className={`${styles.priority} ${styles[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                </td>
                <td>
                  {isTeamLeader ? (
                    <div className={styles.buttonRow}>
                      <button
                        className={styles.editButton}
                        onClick={() => {
                          handleEdit(task);
                          setShowModal(true);
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDelete(task._id)}
                      >
                        🗑 Delete
                      </button>
                     {task?.isAssigned ? (
  <div className={styles.assignPlaceholder}></div>
) : (
  <button
    className={styles.assignButton}
    onClick={() => handleAssign(task)}
  >
    📌 Assign
  </button>
)}
                    </div>
                  ) : (
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "600",
                        background: task?.isAssigned ? "#e8f5e9" : "#f3f4f6",
                        color: task?.isAssigned ? "#2e7d32" : "#6b7280",
                      }}
                    >
                      {task?.isAssigned
                        ? `✅ Assigned${taskAssigneeMap[String(task._id)] ? ` · ${taskAssigneeMap[String(task._id)]}` : ""}`
                        : "⏳ Unassigned"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


export default CreateTask;
