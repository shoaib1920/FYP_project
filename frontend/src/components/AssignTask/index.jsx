import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import {
  FaTasks, FaUserPlus, FaClipboardList, FaEdit, FaTrash,
  FaCheck, FaTimes, FaExclamationCircle,
} from "react-icons/fa";

const ROLE_CLASS = {
  Developer: styles.roleDeveloper,
  Moderator: styles.roleModerator,
  Admin: styles.roleAdmin,
  Tester: styles.roleTester,
  Designer: styles.roleDesigner,
};

const initials = (name = "") =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

const AssignTask = () => {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles] = useState(["Developer", "Moderator", "Admin", "Tester", "Designer"]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [isTeamLeader, setIsTeamLeader] = useState(false);
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchProjects();
    fetchAssignedTasks();
    checkIfLeader();
  }, []);

  // ✅ Refetch users once leader status and group members are determined
  useEffect(() => {
    fetchUsers();
  }, [isTeamLeader, groupMemberIds]);

  const fetchProjects = async () => {
    try {
      const loggedInUser = JSON.parse(localStorage.getItem("user"));
      if (!loggedInUser || !loggedInUser.id) {
        alert("User not found. Please log in again!");
        return;
      }

      const userId = loggedInUser.id;
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/tasks?createdBy=${userId}&isAssigned=false`
      );
      setProjects(response.data);
    } catch (error) {
      console.error("Error fetching projects", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const loggedInUser = JSON.parse(localStorage.getItem("user"));

      if (!loggedInUser || !loggedInUser.id) {
        alert("User not found. Please log in again!");
        return;
      }

      const userId = loggedInUser.id;

      const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/users`);
      const allUsers = response.data.users || response.data;

      // ✅ Filter to show only team/group members
      let filteredUsers = allUsers.filter(user => groupMemberIds.includes(user._id));

      // ✅ Allow leaders to also assign to themselves if not already in filtered list
      if (isTeamLeader && !filteredUsers.some(u => u._id === userId)) {
        filteredUsers.push(allUsers.find(u => u._id === userId));
      }

      setUsers(filteredUsers);
    } catch (error) {
      console.error("Error fetching users", error);
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
  };

  const handleUpdateTask = async () => {
    if (!editingTask.project || !editingTask.user || !editingTask.role) {
      alert("All fields are required!");
      return;
    }

    setSavingEdit(true);
    try {
      const updateData = {
        project: editingTask.project,
        user: editingTask.user,
        user_id: editingTask.user_id,
        role: editingTask.role,
        assignedBy: editingTask.assignedBy,
        assignerJoinCode: editingTask.assignerJoinCode || null,
        department: editingTask.department || null,
      };

      await axios.put(`${process.env.REACT_APP_API_URL}/auth/assigntask/${editingTask._id}`, updateData);
      alert("Task updated successfully!");
      setEditingTask(null);
      fetchAssignedTasks();
    } catch (error) {
      console.error("❌ Error updating task:", error.response?.data || error.message);
      alert("Error updating task: " + (error.response?.data?.message || error.message));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    setDeletingId(taskId);
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/auth/assigntask/${taskId}`);
      setAssignedTasks(assignedTasks.filter((task) => task._id !== taskId));
      console.log("✅ Task deleted successfully!");
    } catch (error) {
      console.error("❌ Error deleting task:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const fetchAssignedTasks = async () => {
    try {
      const loggedInUser = JSON.parse(localStorage.getItem("user"));
      if (!loggedInUser || !loggedInUser.id) {
        alert("User not found. Please log in again!");
        return;
      }

      const userId = loggedInUser.id;
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/assigned-tasks?userId=${userId}`);
      setAssignedTasks(response.data);
    } catch (error) {
      console.error("❌ Error fetching assigned tasks:", error);
    }
  };

  const handleSubmit = async () => {
    if (!isTeamLeader) {
      alert("Only the group leader can assign tasks.");
      return;
    }

    try {
      if (!selectedProject || !selectedUser || !selectedRole) {
        alert("Please select all fields before assigning the task!");
        return;
      }

      const loggedInUser = JSON.parse(localStorage.getItem("user"));
      if (!loggedInUser || !loggedInUser.id) {
        alert("User not found. Please log in again!");
        return;
      }

      const assignedBy = loggedInUser.id;
      const [userId, userName] = selectedUser.split(",");
      const requestBody = {
        project: String(selectedProject),
        user: String(userName),
        user_id: String(userId),
        role: selectedRole,
        assignedBy: String(assignedBy),
      };

      setAssigning(true);
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/assigntask`, requestBody);

      console.log("✅ Task Assigned Successfully:", response.data);
      setSelectedProject("");
      setSelectedUser("");
      setSelectedRole("");
      fetchProjects();
      fetchAssignedTasks();
    } catch (error) {
      console.error("❌ Error assigning task:", error.response ? error.response.data : error);
    } finally {
      setAssigning(false);
    }
  };

  const checkIfLeader = async () => {
    try {
      const loggedInUser = JSON.parse(localStorage.getItem("user"));
      if (!loggedInUser || !loggedInUser.id) return;
      const userId = loggedInUser.id;
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/teams`);
      const allTeams = Array.isArray(response.data.teams) ? response.data.teams : [];

      const leaderTeam = allTeams.some(
        (team) => String(team.createdBy?._id || team.createdBy) === String(userId)
      );
      setIsTeamLeader(leaderTeam);

      const userTeams = allTeams.filter((team) =>
        (team.members || []).some((member) => String(member._id || member) === String(userId))
      );

      const memberIds = new Set();
      userTeams.forEach((team) => {
        (team.members || []).forEach((member) => {
          memberIds.add(String(member._id || member));
        });
      });

      memberIds.add(userId);

      setGroupMemberIds(Array.from(memberIds));
    } catch (error) {
      console.error("Error checking leader status", error);
    }
  };

  return (
    <div className={styles.container}>
      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaTasks /></div>
        <div className={styles.heroText}>
          <h1 className={styles.heading}>Assign Tasks</h1>
          <p className={styles.subheading}>
            Distribute project tasks to your team members and keep ownership clear.
          </p>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.statChip}>
            <strong>{projects.length}</strong>
            <span>Unassigned</span>
          </div>
          <div className={styles.statChip}>
            <strong>{assignedTasks.length}</strong>
            <span>Assigned</span>
          </div>
          <div className={styles.statChip}>
            <strong>{groupMemberIds.length}</strong>
            <span>Team Members</span>
          </div>
        </div>
      </div>

      {/* ── Leader-only notice ── */}
      {!isTeamLeader && (
        <div className={styles.noticeBox}>
          <FaExclamationCircle />
          <span>Only the group leader can assign tasks. You can still view the current assignments below.</span>
        </div>
      )}

      {/* ── New assignment form (leader only) ── */}
      {isTeamLeader && (
        <div className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <FaUserPlus />
            <h3>New Assignment</h3>
          </div>

          <div className={styles.formContainer}>
            <div className={styles.fieldGroup}>
              <label>Task</label>
              <select
                className={styles.select}
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">Select Task</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>{project.title}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label>Team Member</label>
              <select
                className={styles.select}
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="">Select Member</option>
                {users.map((user) => (
                  <option key={user._id} value={[user._id, user.name]}>{user.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label>Role</label>
              <select
                className={styles.select}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          <button className={styles.assignButton} onClick={handleSubmit} disabled={assigning}>
            <FaUserPlus /> {assigning ? "Assigning..." : "Assign Task"}
          </button>
        </div>
      )}

      {/* ── Assigned tasks ── */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionLeft}>
          <div className={styles.sectionIconWrap}><FaClipboardList /></div>
          <div>
            <div className={styles.sectionTitle}>Assigned Tasks</div>
            <div className={styles.sectionSubtitle}>Track who's responsible for what</div>
          </div>
        </div>
        <span className={styles.countBadge}>{assignedTasks.length}</span>
      </div>

      {assignedTasks.length === 0 ? (
        <div className={styles.emptyBox}>
          <div className={styles.emptyIconWrap}><FaClipboardList /></div>
          <h4>No tasks assigned yet</h4>
          <p>
            {isTeamLeader
              ? "Use the form above to assign your first task to a team member."
              : "Your group leader hasn't assigned any tasks yet."}
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.taskTable}>
            <thead>
              <tr>
                <th>Task</th>
                <th>Assigned To</th>
                <th>Role</th>
                {isTeamLeader && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {assignedTasks.map((task) => (
                <tr key={task._id}>
                  <td>
                    {editingTask?._id === task._id ? (
                      <select
                        className={styles.select}
                        value={editingTask.project}
                        onChange={(e) => setEditingTask({ ...editingTask, project: e.target.value })}
                      >
                        {projects.map((p) => (
                          <option key={p._id} value={p._id}>{p.title}</option>
                        ))}
                      </select>
                    ) : (
                      task.projectTitle || task.project
                    )}
                  </td>
                  <td>
                    {editingTask?._id === task._id ? (
                      <select
                        className={styles.select}
                        value={`${editingTask.user_id},${editingTask.user}`}
                        onChange={(e) => {
                          const [userId, userName] = e.target.value.split(",");
                          setEditingTask({ ...editingTask, user_id: userId, user: userName });
                        }}
                      >
                        {users.map((user) => (
                          <option key={user._id} value={`${user._id},${user.name}`}>{user.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className={styles.userCell}>
                        <span className={styles.userAvatar}>{initials(task.user)}</span>
                        <span>{task.user}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    {editingTask?._id === task._id ? (
                      <select
                        className={styles.select}
                        value={editingTask.role}
                        onChange={(e) => setEditingTask({ ...editingTask, role: e.target.value })}
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`${styles.roleBadge} ${ROLE_CLASS[task.role] || ""}`}>
                        {task.role}
                      </span>
                    )}
                  </td>
                  {isTeamLeader && (
                    <td>
                      {editingTask?._id === task._id ? (
                        <div className={styles.actionRow}>
                          <button className={styles.updateButton} onClick={handleUpdateTask} disabled={savingEdit}>
                            <FaCheck /> {savingEdit ? "Saving..." : "Save"}
                          </button>
                          <button className={styles.cancelButton} onClick={() => setEditingTask(null)} disabled={savingEdit}>
                            <FaTimes /> Cancel
                          </button>
                        </div>
                      ) : (
                        <div className={styles.actionRow}>
                          <button className={styles.editButton} onClick={() => handleEdit(task)}>
                            <FaEdit /> Edit
                          </button>
                          <button
                            className={styles.deleteButton}
                            onClick={() => handleDelete(task._id)}
                            disabled={deletingId === task._id}
                          >
                            <FaTrash /> {deletingId === task._id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AssignTask;
