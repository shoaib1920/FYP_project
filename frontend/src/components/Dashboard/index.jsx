import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import { useNavigate } from "react-router-dom";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard = ({ setActiveModule }) => {
  const navigate = useNavigate();

  // State variables for fetching actual data
  const [taskSummary, setTaskSummary] = useState({
    total: 0,
    completed: 0,
    pending: 0,
  });
  const [progressLabels, setProgressLabels] = useState([]);
  const [progressCompletedData, setProgressCompletedData] = useState([]);
  const [progressPendingData, setProgressPendingData] = useState([]);
  const [users, setUsers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [showTeamModal, setShowTeamModal] = useState(false); // ✅ for Team Modal
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");

  const [teamSubject, setTeamSubject] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);

  const [allTeams, setAllTeams] = useState([]);
  const [yourTeams, setYourTeams] = useState([]);
  const [otherTeams, setOtherTeams] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("myTeams");
  const [showManageTeamsModal, setShowManageTeamsModal] = useState(false);
  const myTeams = ["Team A", "Team B", "Team C"];
  const [showAllTeamModal, setShowAllTeamModal] = useState(false);

  const loggedInUser = JSON.parse(localStorage.getItem("user"));
  const userId = loggedInUser.id; // ✅ Get user ID

const departmentName = loggedInUser.department;
const studentJoinCode = loggedInUser.studentJoinCode;
  const userName = loggedInUser.name;
  // Determine if the current user is a leader (created any of their teams)
  const isLeader = yourTeams.some((team) => String(team.createdBy) === String(userId));
  const hasTeamMembership = yourTeams.length > 0;
  const canCreateTeam = !hasTeamMembership || isLeader;
  const [searchTerm, setSearchTerm] = useState("");

  // Compute team member ids for this user (used to filter leaderboard)
  const teamMemberIdsForFiltering = yourTeams.flatMap((team) =>
    (team.members || []).map((m) => String(m._id))
  );

  // Filter leaderboard to same-department students (by studentJoinCode) OR team members
  const filteredLeaderboard = leaderboard.filter((entry) => {
    const usr = users.find((u) => String(u._id) === String(entry.userId) || String(u.id) === String(entry.userId));
    const sameDept = usr && String(usr.studentJoinCode).toUpperCase() === String(studentJoinCode).toUpperCase();
    const inTeam = teamMemberIdsForFiltering.includes(String(entry.userId));
    return sameDept || inTeam;
  });

  const openModal = () => {
    setIsModalOpen(true)
    setActiveTab("myTeams"); // Default tab
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/users`);
      setUsers(response.data);
      // console.log("Users fetched successfully:", response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDashboardData();
    fetchTeams();
  }, []);

 const filteredUsers = availableStudents.filter(
  (user) =>
    (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.registration_id
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase())) &&
    user._id !== userId
);

  const fetchTeams = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/teams`);
      const teams = response.data.teams;


const teamMemberIds = teams.flatMap((team) =>
  team.members.map((member) => member._id)
);

console.log("Team Member IDs:", teamMemberIds);
console.log("fetched users???", users);

const responseuser = await axios.get(`${process.env.REACT_APP_API_URL}/auth/users`);
const allUsers=responseuser.data;
const available = allUsers
  .filter(
    (user) =>
      user.designation === "Student" &&
      !teamMemberIds.includes(user._id.toString()) &&
      String(user.studentJoinCode).toUpperCase() === String(studentJoinCode).toUpperCase()
  )
  .map((student) => ({
    _id: student._id,
    name: student.name,
    registration_id: student.studentId, // ya jo bhi field ka exact naam hai
  }));

setAvailableStudents(available);

console.log("Available Students:", available);

      const your = teams.filter((team) =>
        team.members.some((member) => member._id === userId)
      );

      const others = teams.filter(
        (team) => !team.members.some((member) => member._id === userId)
      );

      // console.log("my teams>>>", your);
      // console.log("other teams>>>", others);
// 
      setAllTeams(teams);
      setYourTeams(your);
      setOtherTeams(others);
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  // Fetch Dashboard Data
  const fetchDashboardData = async () => {
    try {
      // Fetch task summary
      const taskSummaryResponse = await fetch(
        `${process.env.REACT_APP_API_URL}/auth/dashboard/task-summary?userId=${userId}`
      );

      // Convert response to JSON
      const taskSummaryData = await taskSummaryResponse.json();

      // console.log("taskSummaryResponse >>>>>>", taskSummaryData);
      // Set state with JSON data
      setTaskSummary(taskSummaryData);

      // Fetch task progress (labels + data) filtered by userId
      try {
        const progressResp = await fetch(
          `${process.env.REACT_APP_API_URL}/auth/dashboard/task-progress?userId=${userId}`
        );
        const progressJson = await progressResp.json();

        // Prepare a fixed recent-week window (last 8 weeks)
        const WEEKS = 8;
        const getWeekNumber = (d) => {
          const date = new Date(d);
          const onejan = new Date(date.getFullYear(), 0, 1);
          return Math.ceil(((date - onejan) / 86400000 + onejan.getDay() + 1) / 7);
        };

        // Current week number
        const now = new Date();
        const currWeek = getWeekNumber(now);
        const recentWeeks = Array.from({ length: WEEKS }, (_, i) => currWeek - (WEEKS - 1 - i));

        // Build maps from API response (robust to label format 'Week X' or numeric labels)
        const completedMap = {};
        const pendingMap = {};

        if (progressJson && Array.isArray(progressJson.labels) && progressJson.labels.length) {
          progressJson.labels.forEach((lbl, idx) => {
            const match = String(lbl).match(/(\d+)/);
            const weekNum = match ? Number(match[1]) : idx + 1;
            completedMap[weekNum] = progressJson.completedData ? progressJson.completedData[idx] || 0 : 0;
            pendingMap[weekNum] = progressJson.pendingData ? progressJson.pendingData[idx] || 0 : 0;
          });
        } else if (progressJson && Array.isArray(progressJson.completedData)) {
          // fallback: assume index maps to recentWeeks order
          progressJson.completedData.forEach((val, idx) => {
            const weekNum = recentWeeks[idx] || idx + 1;
            completedMap[weekNum] = val || 0;
          });
          progressJson.pendingData && progressJson.pendingData.forEach((val, idx) => {
            const weekNum = recentWeeks[idx] || idx + 1;
            pendingMap[weekNum] = val || 0;
          });
        }

        const labels = recentWeeks.map((w) => `Week ${w}`);
        const completedData = recentWeeks.map((w) => completedMap[w] || 0);
        const pendingData = recentWeeks.map((w) => pendingMap[w] || 0);

        setProgressLabels(labels);
        setProgressCompletedData(completedData);
        setProgressPendingData(pendingData);
      } catch (err) {
        console.error("Error fetching task progress:", err);
      }

      // Fetch leaderboard data
      const leaderboardResponse = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/dashboard/leaderboard`
      );
      // console.log("leaderboardResponse.data>>>>>>", leaderboardResponse.data);
      setLeaderboard(leaderboardResponse.data);

      // Fetch recent tasks scoped to current user's group
      const recentTasksResponse = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/dashboard/recent-tasks?userId=${userId}`
      );
      // console.log("recentTasksResponse>>>>>>", recentTasksResponse.data);
      setRecentTasks(recentTasksResponse.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  // Handle team creation
 const handleCreateTeam = async () => {
  try {
    const allMemberIds = [
      userId,
      ...selectedUsers.map((user) => user.id),
    ];

    const allMemberNames = [
      userName,
      ...selectedUsers.map((user) => user.name),
    ];

    const payload = {
      subject: teamSubject,
      memberIds: allMemberIds,
      memberNames: allMemberNames,
      department:  departmentName,
      creatorJoinCode: studentJoinCode,
      createdBy: userId,
      creatorName: userName,
    };

    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/auth/create-team`,
      payload
    );

    if (response.data.success) {
      alert("Team created successfully!");
      setShowTeamModal(false);
      setTeamSubject("");
      setSelectedUsers([]);

      // Keep the cached profile in sync so leader-only checks work without re-login
      const updatedUser = { ...loggedInUser, designation: "TeamLeader" };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      fetchTeams();
    }
  } catch (error) {
    console.error("Error creating team:", error);
  }
};


  // Simple total-based line: two points (Start -> Now) so the chart shows a line instead of a dot
  const taskProgressData = {
    labels: ["Total Tasks", "Completed Tasks", "Pending Tasks"],
    datasets: [
      {
        label: "Tasks",
        data: [
          taskSummary.totalTasks ?? taskSummary.total ?? 0,
          taskSummary.completedTasks || 0,
          taskSummary.pendingTasks || 0,
        ],
        backgroundColor: [
          "rgba(0, 123, 255, 0.7)",
          "rgba(40, 167, 69, 0.7)",
          "rgba(255, 87, 34, 0.7)",
        ],
        borderColor: [
          "#007bff",
          "#28a745",
          "#ff5733",
        ],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    indexAxis: "x",
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Task Summary" },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return Number(value);
          },
        },
      },
      y: {
        beginAtZero: true,
      },
    },
  };
  const handleManageTeamsClick = () => {
    setShowManageTeamsModal(true);
  };

  return (
    <div className={styles.dashboard_container}>
      {/* 🛠️ Create Team Modal */}
      {showTeamModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <h2>Create New Team</h2>
              <button
                className={styles.closeButton}
                onClick={() => setShowTeamModal(false)}
              >
                ❌
              </button>
            </div>

          

            {/* Modal Body */}
            <div className={styles.modalBody}>
              <label className={styles.modalLabel}>Subject:</label>
              <input
                type="text"
                placeholder="Enter Subject Name"
                value={teamSubject}
                onChange={(e) => setTeamSubject(e.target.value)}
                className={styles.modalInput}
              />
     {/* 
              <label className={styles.modalLabel}>Select Team Members:</label>
              <select
                multiple
                value={selectedUsers.map((user) => user.id)}
                onChange={(e) => {
                  const selectedOptions = Array.from(
                    e.target.selectedOptions
                  ).map((option) => ({
                    id: option.value,
                    name: option.getAttribute("data-name"),
                  }));
                  setSelectedUsers((prevSelected) => {
                    const newSelected = [...prevSelected];
                    selectedOptions.forEach((option) => {
                      if (!newSelected.some((user) => user.id === option.id)) {
                        newSelected.push(option);
                      }
                    });
                    return newSelected;
                  });
                }}
                className={styles.modalSelect}
              >
                {users.map((user) => (
                  <option key={user._id} value={user._id} data-name={user.name}>
                    {user.name}
                  </option>
                ))}
              </select> */}
              <label className={styles.modalLabel}>Search Team Members:</label>

          <input
  type="text"
       placeholder="Search student by name or id..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className={styles.modalInput}
      />

   {/* <div className={styles.searchResults}>
     {searchTerm &&
    filteredUsers.map((user) => (
      <div
        key={user._id}
        className={styles.searchItem}
        onClick={() => {
          if (
            !selectedUsers.some(
              (selected) => selected.id === user._id
            )
          ) {
            setSelectedUsers([
              ...selectedUsers,
              {
                id: user._id,
                name: user.name,
              },
            ]);
          }

          setSearchTerm("");
        }}
      >
        {user.name}
      </div>
    ))}
</div> */}
    <div className={styles.searchResults}>
  {searchTerm && filteredUsers.length > 0 ? (
    filteredUsers.map((user) => (
      <div
        key={user._id}
        className={styles.searchItem}
        onClick={() => {
          if (!selectedUsers.some((selected) => selected.id === user._id)) {
            setSelectedUsers((prev) => [
              ...prev,
              {
                id: user._id,
                name: user.name,
              },
            ]);
          }
          setSearchTerm("");
        }}
      >
        <strong>{user.name}</strong>
        <br />
        <small>{user.registration_id}</small>
      </div>
    ))
  ) : (
    searchTerm && (
      <div className={styles.noResults}>
        No student found with this name or registration ID.
      </div>
    )
  )}
</div>




              {/* Selected Members Preview */}
              {/* {selectedUsers.length > 0 && (
                <div className={styles.selectedUsers}>
                  {selectedUsers.map((user) => (
                    <span key={user.id} className={styles.selectedUserBadge}>
                      {user.name}
                    </span>
                  ))}
                </div>
              )} */}

              {selectedUsers.length > 0 && (
  <div className={styles.selectedUsers}>
    {selectedUsers.map((user) => (
      <span
        key={user.id}
        className={styles.selectedUserBadge}
      >
        {user.name}

        <button
          type="button"
          onClick={() =>
            setSelectedUsers(
              selectedUsers.filter(
                (u) => u.id !== user.id
              )
            )
          }
        >
          ✖
        </button>
      </span>
    ))}
  </div>
)}
            </div>

            {/* Modal Footer */}
            <div className={styles.modalFooter}>
              <button
                onClick={() => setShowTeamModal(false)}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                className={styles.createButton}
              >
                Create Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* <h1 className={styles.title}>Dashboard</h1> */}

      {/* 📊 Task Summary & Graph Layout */}
      <div className={styles.overview_section}>
        {/* 📌 Task Summary */}
        <div className={styles.task_summary}>
          <div className={styles.card}>
            <h2>Total Tasks</h2>
            <p className="mt-4">{taskSummary.totalTasks}</p>
          </div>
          <div className={styles.card}>
            <h2>Completed</h2>
            <p className="mt-4">{taskSummary.completedTasks}</p>
          </div>
          <div className={styles.card}>
            <h2>Pending</h2>
            <p className="mt-4">{taskSummary.pendingTasks}</p>
          </div>
        </div>

        {/* 📈 Task Summary Bar Chart */}
        <div className={styles.chart_container}>
          <Bar data={taskProgressData} options={options} />
        </div>
      </div>

      {/* 🏆 Leaderboard Section */}
      <div className={styles.leaderboard}>
        <h2>Top Performers</h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Tasks Completed</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeaderboard.map((user, index) => (
              <tr key={user.userId}>
                <td>#{index + 1}</td>
                <td>{user.userName}</td>
                <td>{user.completedProjects}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 📌 Recent Tasks Section */}
      <div className={styles.recent_tasks}>
        <h2>Recent Tasks</h2>
        <ul>
          {recentTasks.map((task) => (
            <li key={task.id}>
              <span>{task.title}</span>
              {/* <button
                className={styles.view_details}
                onClick={() => navigate(`/task/${task.id}`)}
              >
                View Details
              </button> */}
            </li>
          ))}
        </ul>
      </div>
      {/* Modal ko yahan conditionally render karenge */}
      {showManageTeamsModal && (
        <div className={styles.teammodalOverlay}>
          <div className={styles.teammodalContent}>
            {/* Close Button */}
            <button
              className={styles.closeButton}
              onClick={() => setShowManageTeamsModal(false)}
            >
              ❌
            </button>

            {/* Top Buttons */}
            <div className={styles.tabButtons}>
              <button
                className={`${styles.tabButton} ${
                  activeTab === "myTeams" ? styles.active : ""
                }`}
                onClick={() => setActiveTab("myTeams")}
              >
                My Teams
              </button>
              <button
                className={`${styles.tabButton} ${
                  activeTab === "otherTeams" ? styles.active : ""
                }`}
                onClick={() => setActiveTab("otherTeams")}
              >
                Other Teams
              </button>
            </div>

            {/* Modal Body */}
            <div className={styles.teammodalBody}>
              {activeTab === "myTeams" && (
                <div className={styles.teamList}>
                  {yourTeams.length > 0 ? (
                    yourTeams.map((team) => (
                      <div key={team._id} className={styles.teamCard}>
                        <h3>{team.subject}</h3>
                        <p>
                          <strong>Subject:</strong> {team.subject}
                        </p>
                        <p>
                          <strong>Members ({team.members.length}):</strong>
                        </p>

                        <div className={styles.memberList}>
                          {team.members.map((member) => (
                            <div key={member._id} className={styles.memberItem}>
                              <span className={styles.memberIcon}>👤</span>
                              <span className={styles.memberName}>
                                {member.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>No teams found.</p>
                  )}
                </div>
              )}

              {activeTab === "otherTeams" && (
                <div className={styles.teamList}>
                  {otherTeams.length > 0 ? (
                    otherTeams.map((team) => (
                      <div key={team._id} className={styles.teamCard}>
                        <h3>{team.subject}</h3>
                        <p>
                          <strong>Subject:</strong> {team.subject}
                        </p>
                        <p>
                          <strong>Members ({team.members.length}):</strong>
                        </p>

                        <div className={styles.memberList}>
                          {team.members.map((member) => (
                            <div key={member._id} className={styles.memberItem}>
                              <span className={styles.memberIcon}>👤</span>
                              <span className={styles.memberName}>
                                {member.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>No teams found.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ⚡ Quick Actions */}
      <div className={styles.actions}>
        <button
          className={styles.create_task}
          onClick={() => {
            if (!isLeader) {
              alert("Only the group leader can create tasks.");
              return;
            }
            setActiveModule("CreateTask");
          }}
        >
          ➕ Create Task
        </button>
        <button
          className={styles.manage_teams}
          onClick={() => handleManageTeamsClick(true)}
        >
          👥 Manage Teams
        </button>
        <button
          className={styles.create_team}
          onClick={() => {
            if (!canCreateTeam) {
              alert("Only the group leader can create a team once you've already joined one.");
              return;
            }
            setShowTeamModal(true);
          }}
        >
          🛠️ Create Team
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
