import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import { useNavigate } from "react-router-dom";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  FaRocket, FaUsers, FaChartBar, FaTrophy,
  FaClipboardList, FaCheckCircle, FaLock, FaFileAlt, FaTimes,
  FaPlus, FaUsersCog, FaUserPlus, FaSearch, FaClock,
} from "react-icons/fa";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Title, Tooltip, Legend);

const Dashboard = ({ setActiveModule }) => {
  const navigate = useNavigate();

  const [taskSummary, setTaskSummary] = useState({ total: 0, completed: 0, pending: 0 });
  const [progressLabels, setProgressLabels] = useState([]);
  const [progressCompletedData, setProgressCompletedData] = useState([]);
  const [progressPendingData, setProgressPendingData] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamSubject, setTeamSubject] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [yourTeams, setYourTeams] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("myTeams");
  const [showManageTeamsModal, setShowManageTeamsModal] = useState(false);
  const [showAllTeamModal, setShowAllTeamModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [respondingInvite, setRespondingInvite] = useState(null); // `${teamId}_${action}`
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [cancelingInviteId, setCancelingInviteId] = useState(null);
  const [addMemberOpenFor, setAddMemberOpenFor] = useState(null); // teamId currently showing the "invite more" form
  const [addMemberSearchTerm, setAddMemberSearchTerm] = useState("");
  const [addMemberSelected, setAddMemberSelected] = useState([]);
  const [invitingMore, setInvitingMore] = useState(false);

  const loggedInUser = JSON.parse(localStorage.getItem("user"));
  const userId = loggedInUser.id;
  const departmentName = loggedInUser.department;
  const studentJoinCode = loggedInUser.studentJoinCode;
  const userName = loggedInUser.name;

  const isLeader = yourTeams.some((team) => String(team.createdBy) === String(userId));
  const hasTeamMembership = yourTeams.length > 0;
  const canCreateTeam = !hasTeamMembership || isLeader;

  const myTeam = yourTeams.find((team) => String(team.createdBy) === String(userId)) || yourTeams[0] || null;
  // A team with only the leader in it hasn't really "formed" yet, even though
  // the record exists to track pending invites — don't present it as joined.
  const teamIsFormed = hasTeamMembership && !!myTeam && (myTeam.members || []).length > 1;

  // Invites still unanswered on a team I lead — proposal submission is blocked until these clear.
  const myTeamPendingInvites = yourTeams
    .filter((team) => String(team.createdBy) === String(userId))
    .flatMap((team) => team.pendingInvites || []);
  const teamReadyForProposal = teamIsFormed && myTeamPendingInvites.length === 0;

  const yourTeamIds = yourTeams.map((team) => String(team._id));
  const otherTeams = allTeams.filter((team) => !yourTeamIds.includes(String(team._id)));

  const filteredUsers = availableStudents.filter(
    (user) =>
      (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.registration_id?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      user._id !== userId
  );

  const addMemberFilteredUsers = availableStudents.filter(
    (user) =>
      (user.name.toLowerCase().includes(addMemberSearchTerm.toLowerCase()) ||
        user.registration_id?.toLowerCase().includes(addMemberSearchTerm.toLowerCase())) &&
      user._id !== userId
  );

  const fetchTeams = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/teams`);
      const teams = response.data.teams;
      const teamMemberIds = teams.flatMap((team) => team.members.map((member) => member._id));
      const responseuser = await axios.get(`${process.env.REACT_APP_API_URL}/auth/users`);
      const allUsers = responseuser.data;
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
          registration_id: student.studentId,
        }));
      setAvailableStudents(available);
      setAllTeams(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  // Scoped to the logged-in user: teams they belong to + invites awaiting their response.
  const fetchMyTeams = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/my-teams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setYourTeams(response.data.teams || []);
      setPendingInvites(response.data.invites || []);
    } catch (error) {
      console.error("Error fetching my teams:", error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const taskSummaryResponse = await fetch(
        `${process.env.REACT_APP_API_URL}/auth/dashboard/task-summary?userId=${userId}`
      );
      const taskSummaryData = await taskSummaryResponse.json();
      setTaskSummary(taskSummaryData);

      try {
        const progressResp = await fetch(
          `${process.env.REACT_APP_API_URL}/auth/dashboard/task-progress?userId=${userId}`
        );
        const progressJson = await progressResp.json();
        const WEEKS = 8;
        const getWeekNumber = (d) => {
          const date = new Date(d);
          const onejan = new Date(date.getFullYear(), 0, 1);
          return Math.ceil(((date - onejan) / 86400000 + onejan.getDay() + 1) / 7);
        };
        const now = new Date();
        const currWeek = getWeekNumber(now);
        const recentWeeks = Array.from({ length: WEEKS }, (_, i) => currWeek - (WEEKS - 1 - i));
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
          progressJson.completedData.forEach((val, idx) => {
            const weekNum = recentWeeks[idx] || idx + 1;
            completedMap[weekNum] = val || 0;
          });
          progressJson.pendingData && progressJson.pendingData.forEach((val, idx) => {
            const weekNum = recentWeeks[idx] || idx + 1;
            pendingMap[weekNum] = val || 0;
          });
        }
        setProgressLabels(recentWeeks.map((w) => `Week ${w}`));
        setProgressCompletedData(recentWeeks.map((w) => completedMap[w] || 0));
        setProgressPendingData(recentWeeks.map((w) => pendingMap[w] || 0));
      } catch (err) {
        console.error("Error fetching task progress:", err);
      }

      const leaderboardResponse = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/dashboard/leaderboard?userId=${userId}`
      );
      setLeaderboard(leaderboardResponse.data);

      const recentTasksResponse = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/dashboard/recent-tasks?userId=${userId}`
      );
      setRecentTasks(recentTasksResponse.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.allSettled([fetchDashboardData(), fetchTeams(), fetchMyTeams()]);
      setLoading(false);
    };
    init();
  }, []);

  const handleCreateTeam = async () => {
    if (selectedUsers.length === 0) {
      alert("Invite at least one teammate to your team.");
      return;
    }
    setCreatingTeam(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        subject: teamSubject,
        memberIds: selectedUsers.map((user) => user.id),
        memberNames: selectedUsers.map((user) => user.name),
        department: departmentName,
        creatorJoinCode: studentJoinCode,
        creatorName: userName,
      };
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/auth/create-team`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        alert("Team created! Invites have been sent to the selected students — they'll need to accept before joining.");
        setShowTeamModal(false);
        setTeamSubject("");
        setSelectedUsers([]);
        const updatedUser = { ...loggedInUser, designation: "TeamLeader" };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        fetchMyTeams();
      }
    } catch (error) {
      console.error("Error creating team:", error);
      alert(error.response?.data?.message || "Error creating team");
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleRespondToInvite = async (teamId, action) => {
    setRespondingInvite(`${teamId}_${action}`);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/auth/teams/${teamId}/invites/respond`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        fetchMyTeams();
      }
    } catch (error) {
      console.error("Error responding to invite:", error);
      alert(error.response?.data?.message || "Error responding to invite");
    } finally {
      setRespondingInvite(null);
    }
  };

  const handleRemoveMember = async (teamId, memberId) => {
    if (!window.confirm("Remove this member from the team?")) return;
    setRemovingMemberId(memberId);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `${process.env.REACT_APP_API_URL}/auth/teams/${teamId}/members/${memberId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        fetchMyTeams();
      }
    } catch (error) {
      console.error("Error removing member:", error);
      alert(error.response?.data?.message || "Error removing member");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleCancelInvite = async (teamId, studentId) => {
    setCancelingInviteId(studentId);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `${process.env.REACT_APP_API_URL}/auth/teams/${teamId}/invites/${studentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        fetchMyTeams();
      }
    } catch (error) {
      console.error("Error cancelling invite:", error);
      alert(error.response?.data?.message || "Error cancelling invite");
    } finally {
      setCancelingInviteId(null);
    }
  };

  const handleInviteMore = async (teamId) => {
    if (addMemberSelected.length === 0) {
      alert("Pick at least one student to invite.");
      return;
    }
    setInvitingMore(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/auth/teams/${teamId}/invites`,
        { memberIds: addMemberSelected.map((u) => u.id) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setAddMemberSelected([]);
        setAddMemberSearchTerm("");
        setAddMemberOpenFor(null);
        fetchMyTeams();
      }
    } catch (error) {
      console.error("Error inviting more members:", error);
      alert(error.response?.data?.message || "Error inviting more members");
    } finally {
      setInvitingMore(false);
    }
  };

  const totalTasks = taskSummary.totalTasks ?? taskSummary.total ?? 0;
  const completedTasks = taskSummary.completedTasks ?? taskSummary.completed ?? 0;
  const pendingTasks = taskSummary.pendingTasks ?? taskSummary.pending ?? 0;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const hasNoData = !loading && totalTasks === 0;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const taskProgressData = {
    labels: ["Total Tasks", "Completed Tasks", "Pending Tasks"],
    datasets: [{
      label: "Tasks",
      data: [totalTasks, completedTasks, pendingTasks],
      backgroundColor: ["rgba(0,123,255,0.7)", "rgba(40,167,69,0.7)", "rgba(255,87,34,0.7)"],
      borderColor: ["#007bff", "#28a745", "#ff5733"],
      borderWidth: 1,
    }],
  };

  const chartOptions = {
    indexAxis: "x",
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Task Summary" },
    },
    scales: {
      x: { beginAtZero: true, ticks: { callback: (v) => Number(v) } },
      y: { beginAtZero: true },
    },
  };

  const hasWeeklyData = progressCompletedData.some((v) => v > 0) || progressPendingData.some((v) => v > 0);

  const weeklyProgressData = {
    labels: progressLabels,
    datasets: [
      {
        label: "Completed",
        data: progressCompletedData,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.12)",
        borderWidth: 2.5,
        pointBackgroundColor: "#22c55e",
        pointRadius: 4,
        tension: 0.4,
        fill: true,
      },
      {
        label: "Pending",
        data: progressPendingData,
        borderColor: "#f97316",
        backgroundColor: "rgba(249,115,22,0.08)",
        borderWidth: 2.5,
        pointBackgroundColor: "#f97316",
        pointRadius: 4,
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const weeklyChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top", labels: { font: { size: 12 }, boxWidth: 12, padding: 16 } },
      title: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: "rgba(0,0,0,0.04)" } },
    },
  };

  const steps = [
    { icon: <FaCheckCircle />, label: "Email verified & account created", done: true },
    {
      icon: <FaUsers />,
      label: teamIsFormed
        ? `Team joined: ${myTeam?.subject || "your team"}`
        : hasTeamMembership
        ? `Waiting for teammates to accept your invite${myTeamPendingInvites.length === 1 ? "" : "s"}...`
        : "Create or join a team",
      done: teamIsFormed,
      action: !hasTeamMembership ? () => setShowTeamModal(true) : null,
      actionLabel: "Create Team",
    },
    {
      icon: <FaFileAlt />,
      label: !hasTeamMembership
        ? "Submit your FYP proposal"
        : teamReadyForProposal
        ? "Submit your FYP proposal"
        : `Submit your FYP proposal (waiting on ${myTeamPendingInvites.length} teammate${myTeamPendingInvites.length === 1 ? "" : "s"})`,
      done: false,
      locked: !teamReadyForProposal,
      action: teamReadyForProposal ? () => setActiveModule("StudentProposal") : null,
      actionLabel: "Go to Proposal",
    },
    { icon: <FaClipboardList />, label: "Work on assigned tasks", done: completedTasks > 0, locked: !hasTeamMembership },
  ];

  return (
    <div className={styles.dashboard_container}>

      {/* ── Welcome Banner ── */}
      <div className={styles.welcomeBanner}>
        <div className={styles.welcomeLeft}>
          <span className={styles.welcomeGreet}>{getGreeting()}, {userName.split(" ")[0]}!</span>
          <h1 className={styles.welcomeTitle}>Your FYP Dashboard</h1>
          <p className={styles.welcomeSub}>{departmentName} &nbsp;•&nbsp; FYP Management Portal</p>
        </div>
        <div className={styles.welcomeRight}>
          {totalTasks > 0 ? (
            <div className={styles.progressCircle}>
              <svg viewBox="0 0 36 36" className={styles.progressSvg}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="white" strokeWidth="3"
                  strokeDasharray={`${progressPct} ${100 - progressPct}`}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <div className={styles.progressLabel}>
                <span className={styles.progressNum}>{progressPct}%</span>
                <span className={styles.progressText}>Complete</span>
              </div>
            </div>
          ) : (
            <div className={styles.welcomeNudge}>
              <FaRocket className={styles.nudgeIcon} />
              <span>Start your FYP journey</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Getting Started (fresh student, or team still forming) ── */}
      {!loading && !teamIsFormed && (
        <div className={styles.getStarted}>
          <div className={styles.getStartedHeader}>
            <FaRocket className={styles.gsIcon} />
            <div>
              <h3 className={styles.gsTitle}>Getting Started</h3>
              <p className={styles.gsSub}>Follow these steps to kick off your FYP journey</p>
            </div>
          </div>
          <div className={styles.stepsTrack}>
            {steps.map((step, i) => (
              <div key={i} className={`${styles.step} ${step.done ? styles.stepDone : step.locked ? styles.stepLocked : styles.stepActive}`}>
                <div className={styles.stepIconWrap}>{step.done ? <FaCheckCircle /> : step.locked ? <FaLock /> : step.icon}</div>
                <div className={styles.stepBody}>
                  <span className={styles.stepLabel}>{step.label}</span>
                </div>
                {step.action && (
                  <button className={styles.stepBtn} onClick={step.action}>{step.actionLabel} →</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pending Team Invites (received by me) ── */}
      {!loading && pendingInvites.length > 0 && (
        <div className={styles.getStarted}>
          <div className={styles.getStartedHeader}>
            <FaUsers className={styles.gsIcon} />
            <div>
              <h3 className={styles.gsTitle}>Team Invitations</h3>
              <p className={styles.gsSub}>
                You've been invited to join {pendingInvites.length === 1 ? "a team" : `${pendingInvites.length} teams`}
              </p>
            </div>
          </div>
          <div className={styles.stepsTrack}>
            {pendingInvites.map((invite) => (
              <div key={invite.teamId} className={`${styles.step} ${styles.stepActive}`}>
                <div className={styles.stepIconWrap}><FaUsers /></div>
                <div className={styles.stepBody}>
                  <span className={styles.stepLabel}>{invite.subject}</span>
                  <div>Invited by {invite.creatorName}</div>
                </div>
                <button
                  className={styles.stepBtn}
                  onClick={() => handleRespondToInvite(invite.teamId, "accept")}
                  disabled={respondingInvite === `${invite.teamId}_accept` || respondingInvite === `${invite.teamId}_decline`}
                >
                  {respondingInvite === `${invite.teamId}_accept` ? "Accepting..." : "Accept"}
                </button>
                <button
                  className={styles.stepBtn}
                  style={{ background: "#6b7280" }}
                  onClick={() => handleRespondToInvite(invite.teamId, "decline")}
                  disabled={respondingInvite === `${invite.teamId}_accept` || respondingInvite === `${invite.teamId}_decline`}
                >
                  {respondingInvite === `${invite.teamId}_decline` ? "Declining..." : "Decline"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Outstanding invites on a team I lead (blocks proposal submission) ── */}
      {!loading && myTeamPendingInvites.length > 0 && (
        <div className={styles.getStarted}>
          <div className={styles.getStartedHeader}>
            <FaLock className={styles.gsIcon} />
            <div>
              <h3 className={styles.gsTitle}>Team Not Ready Yet</h3>
              <p className={styles.gsSub}>
                Waiting on {myTeamPendingInvites.length === 1 ? "a response" : `${myTeamPendingInvites.length} responses`} before you can submit a proposal
              </p>
            </div>
          </div>
          <div className={styles.stepsTrack}>
            {myTeamPendingInvites.map((inv) => (
              <div key={String(inv.student)} className={`${styles.step} ${styles.stepLocked}`}>
                <div className={styles.stepIconWrap}><FaLock /></div>
                <div className={styles.stepBody}>
                  <span className={styles.stepLabel}>{inv.name}</span>
                  <div>Hasn't responded to the invite yet</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create Team Modal ── */}
      {showTeamModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h2><FaUserPlus className={styles.modalHeaderIcon} /> Create New Team</h2>
              <button className={styles.closeButton} onClick={() => setShowTeamModal(false)}><FaTimes /></button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.modalLabel}>Subject</label>
              <input type="text" placeholder="Enter Subject Name" value={teamSubject} onChange={(e) => setTeamSubject(e.target.value)} className={styles.modalInput} />
              <label className={styles.modalLabel}>Search Team Members</label>
              <div className={styles.searchInputWrap}>
                <FaSearch className={styles.searchInputIcon} />
                <input type="text" placeholder="Search student by name or id..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={styles.modalInput} />
              </div>
              {searchTerm && (
                <div className={styles.searchResults}>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <div key={user._id} className={styles.searchItem} onClick={() => {
                        if (!selectedUsers.some((s) => s.id === user._id)) {
                          setSelectedUsers((prev) => [...prev, { id: user._id, name: user.name }]);
                        }
                        setSearchTerm("");
                      }}>
                        <span className={styles.avatarCircle}>{user.name.charAt(0).toUpperCase()}</span>
                        <div>
                          <strong>{user.name}</strong>
                          <small>{user.registration_id}</small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.noResults}>No student found with this name or registration ID.</div>
                  )}
                </div>
              )}
              {selectedUsers.length > 0 && (
                <div className={styles.selectedUsers}>
                  {selectedUsers.map((user) => (
                    <span key={user.id} className={styles.selectedUserBadge}>
                      {user.name}
                      <button type="button" onClick={() => setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id))}><FaTimes /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button onClick={() => setShowTeamModal(false)} className={styles.cancelButton} disabled={creatingTeam}>Cancel</button>
              <button onClick={handleCreateTeam} className={styles.createButton} disabled={creatingTeam}>
                {creatingTeam ? "Creating..." : "Create Team"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats + Chart ── */}
      <div className={styles.overview_section}>
        <div className={styles.task_summary}>
          {[
            { label: "Total Tasks", value: totalTasks, hint: "No tasks assigned yet" },
            { label: "Completed", value: completedTasks, hint: "None completed yet" },
            { label: "Pending", value: pendingTasks, hint: "Nothing pending" },
          ].map(({ label, value, hint }) => (
            <div className={styles.card} key={label}>
              <h2>{label}</h2>
              <p className={styles.statNum}>{loading ? "—" : value}</p>
              {!loading && value === 0 && <span className={styles.statHint}>{hint}</span>}
            </div>
          ))}
        </div>

        {hasNoData ? (
          <div className={styles.chartEmpty}>
            <FaChartBar className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No task data yet</p>
            <span className={styles.emptyText}>Your progress chart will appear once tasks are assigned to your team.</span>
          </div>
        ) : (
          <div className={styles.chart_container}>
            <Bar data={taskProgressData} options={chartOptions} />
          </div>
        )}
      </div>

      {/* ── Weekly Progress Chart ── */}
      <div className={styles.weeklySection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Weekly Progress</h2>
          <span className={styles.sectionBadge}>Last 8 weeks</span>
        </div>
        {hasWeeklyData ? (
          <div className={styles.weeklyChart}>
            <Line data={weeklyProgressData} options={weeklyChartOptions} />
          </div>
        ) : (
          <div className={styles.emptyState}>
            <FaChartBar className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No weekly progress yet</p>
            <span className={styles.emptyText}>Once tasks are assigned and completed, your week-by-week progress will appear here.</span>
          </div>
        )}
      </div>

      {/* ── Leaderboard ── */}
      <div className={styles.leaderboard}>
        <h2>Top Performers</h2>
        {leaderboard.length === 0 ? (
          <div className={styles.emptyState}>
            <FaTrophy className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Leaderboard is empty</p>
            <span className={styles.emptyText}>Complete tasks to appear here and compete with your peers!</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Rank</th><th>Name</th><th>Tasks Completed</th></tr>
            </thead>
            <tbody>
              {leaderboard.map((user, index) => (
                <tr key={user.userId} className={index === 0 ? styles.rankGold : index === 1 ? styles.rankSilver : index === 2 ? styles.rankBronze : ""}>
                  <td className={styles.rankCell}>
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </td>
                  <td>{user.userName}</td>
                  <td><span className={styles.taskCount}>{user.completedProjects}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Recent Tasks ── */}
      <div className={styles.recent_tasks}>
        <h2>Recent Tasks</h2>
        {recentTasks.length === 0 ? (
          <div className={styles.emptyState}>
            <FaClipboardList className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No tasks yet</p>
            <span className={styles.emptyText}>
              {hasTeamMembership
                ? "Your team leader hasn't created any tasks yet. Check back soon!"
                : "Join or create a team first, then your leader can assign tasks here."}
            </span>
          </div>
        ) : (
          <ul>
            {recentTasks.map((task) => (
              <li key={task.id}><span>{task.title}</span></li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Manage Teams Modal ── */}
      {showManageTeamsModal && (
        <div className={styles.teammodalOverlay}>
          <div className={styles.teammodalContent}>
            <button className={styles.closeButton} onClick={() => setShowManageTeamsModal(false)}><FaTimes /></button>
            <h2 className={styles.teammodalTitle}><FaUsersCog className={styles.modalHeaderIcon} /> Manage Teams</h2>
            <div className={styles.tabButtons}>
              <button className={`${styles.tabButton} ${activeTab === "myTeams" ? styles.active : ""}`} onClick={() => setActiveTab("myTeams")}>My Teams</button>
              <button className={`${styles.tabButton} ${activeTab === "otherTeams" ? styles.active : ""}`} onClick={() => setActiveTab("otherTeams")}>Other Teams</button>
            </div>
            <div className={styles.teammodalBody}>
              {(activeTab === "myTeams" ? yourTeams : otherTeams).length > 0 ? (
                <div className={styles.teamList}>
                  {(activeTab === "myTeams" ? yourTeams : otherTeams).map((team) => {
                    const iAmLeaderOfThis = activeTab === "myTeams" && String(team.createdBy) === String(userId);
                    return (
                    <div key={team._id} className={styles.teamCard}>
                      <h3>{team.subject}</h3>
                      <p><strong>Members ({team.members.length}):</strong></p>
                      <div className={styles.memberList}>
                        {team.members.map((member) => (
                          <div key={member._id} className={styles.memberItem}>
                            <span className={styles.avatarCircle}>{(member.name || "?").charAt(0).toUpperCase()}</span>
                            <span className={styles.memberName}>
                              {member.name}
                              {String(member._id) === String(team.createdBy) && (
                                <span className={styles.leaderBadge}>Leader</span>
                              )}
                            </span>
                            {iAmLeaderOfThis && String(member._id) !== String(team.createdBy) && (
                              <button
                                type="button"
                                className={styles.removeMemberBtn}
                                onClick={() => handleRemoveMember(team._id, member._id)}
                                disabled={removingMemberId === member._id}
                              >
                                {removingMemberId === member._id ? "Removing..." : "✕ Remove"}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {iAmLeaderOfThis && (team.pendingInvites || []).length > 0 && (
                        <>
                          <p><strong>Pending invites ({team.pendingInvites.length}):</strong></p>
                          <div className={styles.memberList}>
                            {team.pendingInvites.map((inv) => (
                              <div key={String(inv.student)} className={`${styles.memberItem} ${styles.pendingItem}`}>
                                <span className={styles.pendingIconWrap}><FaClock /></span>
                                <span className={styles.memberName}>{inv.name}</span>
                                <button
                                  type="button"
                                  className={styles.removeMemberBtn}
                                  onClick={() => handleCancelInvite(team._id, inv.student)}
                                  disabled={cancelingInviteId === String(inv.student)}
                                >
                                  {cancelingInviteId === String(inv.student) ? "Cancelling..." : "✕ Cancel"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {iAmLeaderOfThis && (
                        addMemberOpenFor === team._id ? (
                          <div className={styles.addMemberPanel}>
                            <label className={styles.modalLabel}>Search students to invite</label>
                            <div className={styles.searchInputWrap}>
                              <FaSearch className={styles.searchInputIcon} />
                              <input
                                type="text"
                                placeholder="Search student by name or id..."
                                value={addMemberSearchTerm}
                                onChange={(e) => setAddMemberSearchTerm(e.target.value)}
                                className={styles.modalInput}
                              />
                            </div>
                            {addMemberSearchTerm && (
                              <div className={styles.searchResults}>
                                {addMemberFilteredUsers.length > 0 ? (
                                  addMemberFilteredUsers.map((user) => (
                                    <div key={user._id} className={styles.searchItem} onClick={() => {
                                      if (!addMemberSelected.some((s) => s.id === user._id)) {
                                        setAddMemberSelected((prev) => [...prev, { id: user._id, name: user.name }]);
                                      }
                                      setAddMemberSearchTerm("");
                                    }}>
                                      <span className={styles.avatarCircle}>{user.name.charAt(0).toUpperCase()}</span>
                                      <div>
                                        <strong>{user.name}</strong>
                                        <small>{user.registration_id}</small>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className={styles.noResults}>No student found with this name or registration ID.</div>
                                )}
                              </div>
                            )}
                            {addMemberSelected.length > 0 && (
                              <div className={styles.selectedUsers}>
                                {addMemberSelected.map((user) => (
                                  <span key={user.id} className={styles.selectedUserBadge}>
                                    {user.name}
                                    <button type="button" onClick={() => setAddMemberSelected(addMemberSelected.filter((u) => u.id !== user.id))}><FaTimes /></button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className={styles.modalFooter}>
                              <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={() => { setAddMemberOpenFor(null); setAddMemberSelected([]); setAddMemberSearchTerm(""); }}
                                disabled={invitingMore}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className={styles.createButton}
                                onClick={() => handleInviteMore(team._id)}
                                disabled={invitingMore}
                              >
                                {invitingMore ? "Sending..." : "Send Invites"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.inviteMoreBtn}
                            onClick={() => setAddMemberOpenFor(team._id)}
                          >
                            <FaPlus /> Invite More Members
                          </button>
                        )
                      )}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p>No teams found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className={styles.actions}>
        <button
          className={styles.create_task}
          onClick={() => setActiveModule("CreateTask")}
          disabled={!isLeader}
          title={!isLeader ? "Only the team leader can create tasks" : undefined}
        >
          <span className={styles.actionIconWrap}><FaPlus /></span>
          Create Task
        </button>
        <button className={styles.manage_teams} onClick={() => setShowManageTeamsModal(true)}>
          <span className={styles.actionIconWrap}><FaUsersCog /></span>
          Manage Teams
        </button>
        <button
          className={styles.create_team}
          onClick={() => setShowTeamModal(true)}
          disabled={!canCreateTeam}
          title={!canCreateTeam ? "Only the team leader can create a team once you've already joined one" : undefined}
        >
          <span className={styles.actionIconWrap}><FaUserPlus /></span>
          Create Team
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
