import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import {
  FaProjectDiagram,
  FaUserGraduate,
  FaCheckCircle,
  FaHourglassHalf,
  FaExclamationTriangle,
  FaClipboardCheck,
  FaArrowRight,
  FaFileSignature,
  FaBuilding,
  FaComments,
} from "react-icons/fa";

const STATUS_LABELS = {
  ACTIVE: "Active",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  UNDER_REVIEW: "Under Review",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_BADGE = {
  ACTIVE: { bg: "#f3f4f6", color: "#374151" },
  IN_PROGRESS: { bg: "#e3f2fd", color: "#1565c0" },
  ON_HOLD: { bg: "#fff3e0", color: "#e65100" },
  UNDER_REVIEW: { bg: "#f3e5f5", color: "#6a1b9a" },
  COMPLETED: { bg: "#e8f5e9", color: "#2e7d32" },
  CANCELLED: { bg: "#fce4ec", color: "#c62828" },
};

const buildMemberIds = (project) => {
  const ids = new Set();
  if (project.teamLeaderId?._id) ids.add(String(project.teamLeaderId._id));
  if (Array.isArray(project.teamId?.members)) {
    project.teamId.members.forEach((m) => ids.add(String(m._id || m)));
  }
  return ids;
};

const SupervisorDashboard = ({ setActiveModule }) => {
  const [supervisor, setSupervisor] = useState({ name: "", email: "", department: "" });
  const [projects, setProjects] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apiBase = process.env.REACT_APP_API_URL || "";
  const token = localStorage.getItem("token");

  useEffect(() => {
    const storedSupervisor = localStorage.getItem("supervisorData");
    if (storedSupervisor) {
      try {
        const parsed = JSON.parse(storedSupervisor);
        setSupervisor({
          name: parsed.name || "",
          email: parsed.email || "",
          department: parsed.department || "",
        });
      } catch (err) {
        console.error("Failed to parse supervisor data:", err);
      }
    }
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError("");
      const authHeader = { headers: { Authorization: `Bearer ${token}` } };
      try {
        const [projectsRes, proposalsRes, deptRes] = await Promise.all([
          axios.get(`${apiBase}/auth/projects/supervisor`, authHeader),
          axios.get(`${apiBase}/auth/proposals/supervisor`, authHeader),
          axios.get(`${apiBase}/auth/supervisor/my-department`, authHeader),
        ]);
        setProjects(projectsRes.data.projects || []);
        setProposals(proposalsRes.data.proposals || []);
        setDepartment(deptRes.data || null);
      } catch (err) {
        console.error("Error fetching supervisor dashboard data:", err);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [apiBase, token]);

  const stats = useMemo(() => {
    const statusCounts = {
      ACTIVE: 0,
      IN_PROGRESS: 0,
      ON_HOLD: 0,
      UNDER_REVIEW: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    const studentIds = new Set();
    let pendingGradeApproval = 0;
    let flagged = 0;
    let progressSum = 0;
    let progressCount = 0;

    projects.forEach((p) => {
      if (statusCounts[p.status] !== undefined) statusCounts[p.status] += 1;
      buildMemberIds(p).forEach((id) => studentIds.add(id));
      if (p.status === "COMPLETED" && p.gradesStatus === "PENDING_RELEASE") pendingGradeApproval += 1;
      if (p.gradesStatus === "FLAGGED") flagged += 1;
      if (!["COMPLETED", "CANCELLED"].includes(p.status)) {
        progressSum += p.progress || 0;
        progressCount += 1;
      }
    });

    const pendingProposals = proposals.filter((p) => p.status === "SUPERVISOR_ASSIGNED").length;

    return {
      total: projects.length,
      statusCounts,
      studentsAssigned: studentIds.size,
      pendingGradeApproval,
      flagged,
      pendingProposals,
      avgProgress: progressCount ? Math.round(progressSum / progressCount) : 0,
    };
  }, [projects, proposals]);

  const needsAttention = useMemo(() => {
    const items = [];
    proposals
      .filter((p) => p.status === "SUPERVISOR_ASSIGNED")
      .forEach((p) =>
        items.push({
          key: `proposal-${p._id}`,
          title: p.title,
          reason: "New proposal assigned — needs your decision",
          icon: <FaFileSignature />,
          target: "proposal-approval",
        })
      );
    projects
      .filter((p) => p.status === "UNDER_REVIEW")
      .forEach((p) =>
        items.push({
          key: `review-${p._id}`,
          title: p.title,
          reason: "Final report submitted — needs grading",
          icon: <FaClipboardCheck />,
          target: "fyp-projects",
        })
      );
    projects
      .filter((p) => p.status === "COMPLETED" && p.gradesStatus === "FLAGGED")
      .forEach((p) =>
        items.push({
          key: `flagged-${p._id}`,
          title: p.title,
          reason: "Grades flagged by admin — needs re-grade",
          icon: <FaExclamationTriangle />,
          target: "fyp-projects",
        })
      );
    return items;
  }, [projects, proposals]);

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 5),
    [projects]
  );

  const maxStatusCount = Math.max(1, ...Object.values(stats.statusCounts));
  const initials = supervisor.name
    ? supervisor.name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "S";

  const goTo = (module) => setActiveModule && setActiveModule(module);
  const homeDept = department?.homeDepartment;

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroAvatar}>{initials}</div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>
            Welcome back, {supervisor.name ? supervisor.name.split(" ")[0] : "Supervisor"}
          </h2>
          <p className={styles.subheading}>
            {homeDept?.name ? `${homeDept.name} · ` : supervisor.department ? `${supervisor.department} · ` : ""}
            {supervisor.email}
          </p>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {loading ? (
        <div className={styles.loadingState}>Loading dashboard...</div>
      ) : (
        <>
          {/* Quick actions */}
          <div className={styles.quickActions}>
            <button className={styles.quickActionBtn} onClick={() => goTo("proposal-approval")}>
              <FaFileSignature /> Review Proposals
            </button>
            <button className={styles.quickActionBtn} onClick={() => goTo("fyp-projects")}>
              <FaProjectDiagram /> FYP Projects
            </button>
            <button className={styles.quickActionBtn} onClick={() => goTo("AllUserGroups")}>
              <FaUserGraduate /> Students
            </button>
            <button className={styles.quickActionBtn} onClick={() => goTo("ChatBox")}>
              <FaComments /> Messages
            </button>
          </div>

          {/* Stats */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#dbeafe", color: "#1e40af" }}>
                <FaProjectDiagram />
              </div>
              <div>
                <h4>Total Projects</h4>
                <p>{stats.total}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#fef3c7", color: "#92400e" }}>
                <FaFileSignature />
              </div>
              <div>
                <h4>Pending Proposals</h4>
                <p>{stats.pendingProposals}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#ede9fe", color: "#6d28d9" }}>
                <FaHourglassHalf />
              </div>
              <div>
                <h4>Awaiting Your Review</h4>
                <p>{stats.statusCounts.UNDER_REVIEW}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#dcfce7", color: "#15803d" }}>
                <FaUserGraduate />
              </div>
              <div>
                <h4>Students Assigned</h4>
                <p>{stats.studentsAssigned}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                <FaCheckCircle />
              </div>
              <div>
                <h4>Completed Projects</h4>
                <p>{stats.statusCounts.COMPLETED}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#fee2e2", color: "#b91c1c" }}>
                <FaExclamationTriangle />
              </div>
              <div>
                <h4>Flagged Grades</h4>
                <p>{stats.flagged}</p>
              </div>
            </div>
          </div>

          <div className={styles.mainGrid}>
            {/* Status breakdown */}
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Projects by Status</h3>
              <div className={styles.statusBreakdown}>
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <div key={status} className={styles.statusRow}>
                    <span className={styles.statusLabel}>{STATUS_LABELS[status]}</span>
                    <div className={styles.statusBarTrack}>
                      <div
                        className={styles.statusBarFill}
                        style={{
                          width: `${(count / maxStatusCount) * 100}%`,
                          background: STATUS_BADGE[status].color,
                        }}
                      />
                    </div>
                    <span className={styles.statusCount}>{count}</span>
                  </div>
                ))}
              </div>
              <div className={styles.panelFooter}>
                <span>
                  Avg. progress (active projects): <strong>{stats.avgProgress}%</strong>
                </span>
              </div>
            </div>

            {/* Needs attention */}
            <div className={styles.panel}>
              <div className={styles.panelHeaderRow}>
                <h3 className={styles.panelTitle}>Needs Your Attention</h3>
                {needsAttention.length > 0 && (
                  <span className={styles.attentionBadge}>{needsAttention.length}</span>
                )}
              </div>

              {needsAttention.length === 0 ? (
                <p className={styles.emptyNote}>You're all caught up — nothing pending review.</p>
              ) : (
                <ul className={styles.attentionList}>
                  {needsAttention.map((item) => (
                    <li key={item.key} className={styles.attentionItem}>
                      <div>
                        <span className={styles.attentionTitle}>{item.title}</span>
                        <span className={styles.attentionReason}>
                          {item.icon} {item.reason}
                        </span>
                      </div>
                      <button className={styles.attentionGoBtn} onClick={() => goTo(item.target)}>
                        <FaArrowRight />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className={styles.mainGrid} style={{ marginTop: "20px" }}>
            {/* Recent projects */}
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Recent Projects</h3>
              {recentProjects.length === 0 ? (
                <p className={styles.emptyNote}>No projects assigned to you yet.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Team</th>
                        <th>Progress</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentProjects.map((p) => {
                        const badge = STATUS_BADGE[p.status] || STATUS_BADGE.ACTIVE;
                        return (
                          <tr key={p._id}>
                            <td>{p.title}</td>
                            <td>{p.teamId?.subject || "N/A"}</td>
                            <td>
                              <div className={styles.progressWrap}>
                                <div className={styles.progressBar}>
                                  <div className={styles.progressFill} style={{ width: `${p.progress || 0}%` }} />
                                </div>
                                <span>{p.progress || 0}%</span>
                              </div>
                            </td>
                            <td>
                              <span className={styles.badge} style={{ background: badge.bg, color: badge.color }}>
                                {STATUS_LABELS[p.status] || p.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Department snapshot */}
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>
                <FaBuilding style={{ marginRight: "8px" }} />
                Department
              </h3>
              {homeDept ? (
                <div className={styles.deptSnapshot}>
                  <div className={styles.deptName}>{homeDept.name}</div>
                  <div className={styles.deptCode}>
                    {homeDept.code} {homeDept.academicSession ? `· ${homeDept.academicSession}` : ""}
                  </div>
                  <div className={styles.deptStatsRow}>
                    <div>
                      <span className={styles.deptStatNum}>{homeDept.totalStudents ?? "—"}</span>
                      <span className={styles.deptStatLabel}>Students</span>
                    </div>
                    <div>
                      <span className={styles.deptStatNum}>{homeDept.totalTeams ?? "—"}</span>
                      <span className={styles.deptStatLabel}>Teams</span>
                    </div>
                    <div>
                      <span className={styles.deptStatNum}>{homeDept.totalProjects ?? "—"}</span>
                      <span className={styles.deptStatLabel}>Projects</span>
                    </div>
                    <div>
                      <span className={styles.deptStatNum}>{homeDept.totalSupervisors ?? "—"}</span>
                      <span className={styles.deptStatLabel}>Supervisors</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className={styles.emptyNote}>No department information available.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SupervisorDashboard;
