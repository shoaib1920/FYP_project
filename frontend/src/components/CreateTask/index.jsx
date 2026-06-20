import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import { useNavigate } from "react-router-dom";
import DeadlineBanner from "../DeadlineBanner";
import LivePreview from "../LivePreview";

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

  setLoading(true);

  const formData = new FormData();
  formData.append("title", taskData.title);
  formData.append("description", taskData.description);

  if (taskData.taskFile) {
    formData.append("taskFile", taskData.taskFile);
  }

  formData.append("taskCode", taskData.taskCode);
  formData.append("startDate", taskData.startDate);
  formData.append("dueDate", taskData.dueDate);
  formData.append("priority", taskData.priority);
  formData.append("projectId", taskData.projectId);

  // ✅ Send creator ID
  formData.append("createdBy", userId);
  
  // ✅ Send studentJoinCode
  formData.append("studentJoinCode", studentJoinCode);

  try {
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/auth/task`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    const newTask = response.data.task || response.data;

    const formattedTask = {
      ...newTask,
      startDate: newTask.startDate
        ? newTask.startDate.split("T")[0]
        : "N/A",
      dueDate: newTask.dueDate
        ? newTask.dueDate.split("T")[0]
        : "N/A",
    };

    setMessage("✅ Task Created Successfully!");
    setTasks((prevTasks) => [...prevTasks, formattedTask]);

    setTaskData({
      title: "",
      description: "",
      taskFile: null,
      taskCode: "",
      startDate: "",
      dueDate: "",
      priority: "Medium",
      projectId: "",
    });
  } catch (error) {
    setMessage("❌ Error creating task. Please try again.");
    console.error("Task creation error:", error);
  } finally {
    setLoading(false);
    setTimeout(() => setMessage(""), 3000);
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
  const handleOpenModal = () => {
    if (!isTeamLeader) {
      setMessage("Only the team leader can create tasks.");
      return;
    }
    setShowModal(true);
  };
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTaskId(null); // Optional: reset edit mode on close
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

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>📌 Project Manager</h1>

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

      {/* Add Task Button */}
      <button
        onClick={handleOpenModal}
        className={styles.addTaskBtn}
      >
        ➕ Add Task
      </button>

      {isTeamLeader && (
        <button
          onClick={() => navigate("/student/Assign-task")}
          className={styles.addTaskBtn}
          style={{ marginLeft: 10, background: "#7c3aed" }}
        >
          📌 Assign Task
        </button>
      )}
      {!isTeamLeader && (
        <p style={{ marginTop: 8, color: "#c00" }}>
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
              <th>Your Grade</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupProjects.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: "center", color: "#888" }}>
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
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: "600", color: project.githubRepository ? "#2e7d32" : "#c62828" }}>
                          {project.githubRepository ? "✅ GitHub linked" : "⚠️ GitHub missing"}
                        </span>
                        {project.deploymentLink ? (
                          <button
                            onClick={() => setPreviewUrl(project.deploymentLink)}
                            style={{ background: "none", border: "none", color: "#2563eb", fontSize: "11.5px", fontWeight: "600", cursor: "pointer", padding: 0, textAlign: "left" }}
                          >
                            🔗 View Live
                          </button>
                        ) : (
                          <span style={{ fontSize: "11.5px", color: "#9ca3af" }}>Live link not shared</span>
                        )}
                        {isTeamLeader && !["COMPLETED", "CANCELLED"].includes(project.status) && (
                          <button
                            onClick={() => handleOpenLinksModal(project)}
                            style={{ background: "none", border: "none", color: "#7c3aed", fontSize: "11.5px", fontWeight: "600", cursor: "pointer", padding: 0, textAlign: "left" }}
                          >
                            ✏️ Edit Links
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      {(() => {
                        if (project.status !== "COMPLETED") return <span style={{ color: "#9ca3af", fontSize: "12px" }}>—</span>;
                        if (project.gradesStatus === "RELEASED") {
                          const myGrade = project.memberGrades?.find(g => String(g.userId) === String(userId));
                          return myGrade ? (
                            <span style={{ fontWeight: "700", fontSize: "15px", color: "#2e7d32" }}>
                              {myGrade.marks}<span style={{ fontWeight: "400", fontSize: "11px", color: "#6b7280" }}>/100</span>
                            </span>
                          ) : (
                            <span style={{ color: "#2e7d32", fontWeight: "600", fontSize: "13px" }}>
                              {project.evaluationMarks ?? "—"}/100
                            </span>
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
                      {isTeamLeader && ["ACTIVE", "IN_PROGRESS"].includes(project.status) ? (
                        <button
                          onClick={() => handleOpenReportModal(project._id)}
                          style={{
                            padding: "6px 12px", background: "#7c3aed", color: "white",
                            border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600",
                          }}
                        >
                          Submit Report
                        </button>
                      ) : project.status === "UNDER_REVIEW" ? (
                        <span style={{ color: "#6a1b9a", fontSize: "12px", fontWeight: "600" }}>Under Review</span>
                      ) : project.status === "COMPLETED" ? (
                        <span style={{ color: "#2e7d32", fontSize: "12px", fontWeight: "600" }}>Completed</span>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <h1 className={styles.heading}>📌 Task Manager</h1>

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
