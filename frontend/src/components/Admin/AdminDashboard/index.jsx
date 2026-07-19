import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../../Loader";
import Notifications from "../../Notifications";
import UpcomingVivas from "../UpcomingVivas";
import {
  FaProjectDiagram,
  FaUserGraduate,
  FaUserTie,
  FaLayerGroup,
  FaFileSignature,
  FaHourglassHalf,
  FaClipboardCheck,
  FaArrowRight,
  FaBuilding,
  FaStar,
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

const initials = (name) =>
  name ? name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "A";

const AdminDashboard = ({ setActiveModule }) => {
  const [admin, setAdmin] = useState(null);
  const [projects, setProjects] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [students, setStudents] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apiBase = process.env.REACT_APP_API_URL || "";
  const token = localStorage.getItem("adminToken");

  useEffect(() => {
    const stored = localStorage.getItem("adminData");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAdmin(parsed.admin || parsed);
      } catch (err) {
        console.error("Failed to parse admin data:", err);
      }
    }
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError("");
      const authHeader = { headers: { Authorization: `Bearer ${token}` } };
      try {
        const [projectsRes, proposalsRes, deptRes, teamsRes, studentsRes, supervisorsRes] =
          await Promise.all([
            axios.get(`${apiBase}/auth/admin/projects`, authHeader),
            axios.get(`${apiBase}/auth/proposals/admin`, authHeader),
            axios.get(`${apiBase}/auth/admin/department`, authHeader),
            axios.get(`${apiBase}/auth/teams`),
            axios.get(`${apiBase}/auth/users`),
            axios.get(`${apiBase}/auth/supervisors`),
          ]);
        setProjects(projectsRes.data.projects || []);
        setProposals(proposalsRes.data.proposals || []);
        setDepartments(deptRes.data.departments || []);
        setTeams(teamsRes.data.teams || []);
        setStudents(studentsRes.data || []);
        setSupervisors(supervisorsRes.data.supervisors || []);
      } catch (err) {
        console.error("Error fetching admin dashboard data:", err);
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
    let pendingGradeApproval = 0;
    let flagged = 0;

    projects.forEach((p) => {
      if (statusCounts[p.status] !== undefined) statusCounts[p.status] += 1;
      if (p.status === "COMPLETED" && p.gradesStatus === "PENDING_RELEASE") pendingGradeApproval += 1;
      if (p.gradesStatus === "FLAGGED") flagged += 1;
    });

    const pendingProposals = proposals.filter((p) => p.status === "PENDING_ADMIN_REVIEW").length;

    return {
      totalProjects: projects.length,
      statusCounts,
      pendingGradeApproval,
      flagged,
      pendingProposals,
      totalDepartments: departments.length,
      totalTeams: teams.length,
      totalStudents: students.length,
      totalSupervisors: supervisors.length,
    };
  }, [projects, proposals, departments, teams, students, supervisors]);

  const departmentBreakdown = useMemo(() => {
    return departments.map((dept) => {
      const deptId = String(dept._id);
      const deptProjects = projects.filter((p) => String(p.departmentId?._id || p.departmentId) === deptId);
      const deptTeams = teams.filter((t) => t.department === dept.name);
      const deptStudents = students.filter((s) => String(s.department) === deptId);
      return {
        _id: dept._id,
        name: dept.name,
        code: dept.code,
        students: deptStudents.length,
        teams: deptTeams.length,
        projects: deptProjects.length,
      };
    });
  }, [departments, projects, teams, students]);

  const needsAttention = useMemo(() => {
    const items = [];
    proposals
      .filter((p) => p.status === "PENDING_ADMIN_REVIEW")
      .forEach((p) =>
        items.push({
          key: `proposal-${p._id}`,
          title: p.title,
          reason: "New proposal submitted — needs admin review",
          icon: <FaFileSignature />,
          target: "proposal-approval",
        })
      );
    projects
      .filter((p) => p.status === "COMPLETED" && p.gradesStatus === "PENDING_RELEASE")
      .forEach((p) =>
        items.push({
          key: `grade-${p._id}`,
          title: p.title,
          reason: "Grades submitted by supervisor — needs release",
          icon: <FaStar />,
          target: "grade-approval",
        })
      );
    return items;
  }, [proposals, projects]);

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 5),
    [projects]
  );

  const maxStatusCount = Math.max(1, ...Object.values(stats.statusCounts));
  const goTo = (module) => setActiveModule && setActiveModule(module);

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.heroWrap}>
        <div className={styles.hero}>
          <div className={styles.heroAvatar}>{initials(admin?.name)}</div>
          <div className={styles.heroText}>
            <h2 className={styles.heading}>
              Welcome back, {admin?.name ? admin.name.split(" ")[0] : "Admin"}
            </h2>
            <p className={styles.subheading}>{admin?.email || ""}</p>
          </div>
        </div>
        <div className={styles.heroBell}>
          <Notifications tokenKey="adminToken" onOpenRelated={() => goTo("Dashboard")} />
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <UpcomingVivas />

      {loading ? (
        <Loader text="Loading dashboard..." />
      ) : (
        <>
          {/* Quick actions */}
          <div className={styles.quickActions}>
            <button className={styles.quickActionBtn} onClick={() => goTo("proposal-approval")}>
              <FaFileSignature /> Review Proposals
            </button>
            <button className={styles.quickActionBtn} onClick={() => goTo("grade-approval")}>
              <FaStar /> Grade Approval
            </button>
            <button className={styles.quickActionBtn} onClick={() => goTo("DepartmentManagement")}>
              <FaBuilding /> Departments
            </button>
            <button className={styles.quickActionBtn} onClick={() => goTo("Supervisors")}>
              <FaUserTie /> Supervisors
            </button>
            <button className={styles.quickActionBtn} onClick={() => goTo("AllUserGroups")}>
              <FaUserGraduate /> Students
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
                <p>{stats.totalProjects}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#dcfce7", color: "#15803d" }}>
                <FaUserGraduate />
              </div>
              <div>
                <h4>Students</h4>
                <p>{stats.totalStudents}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#ede9fe", color: "#6d28d9" }}>
                <FaUserTie />
              </div>
              <div>
                <h4>Supervisors</h4>
                <p>{stats.totalSupervisors}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#fef3c7", color: "#92400e" }}>
                <FaLayerGroup />
              </div>
              <div>
                <h4>Teams</h4>
                <p>{stats.totalTeams}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#fee2e2", color: "#b91c1c" }}>
                <FaHourglassHalf />
              </div>
              <div>
                <h4>Pending Proposals</h4>
                <p>{stats.pendingProposals}</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#e3f2fd", color: "#1565c0" }}>
                <FaClipboardCheck />
              </div>
              <div>
                <h4>Pending Grade Approval</h4>
                <p>{stats.pendingGradeApproval}</p>
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
                  Total departments: <strong>{stats.totalDepartments}</strong>
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
                <p className={styles.emptyNote}>No projects in the system yet.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Team</th>
                        <th>Supervisor</th>
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
                            <td>{p.supervisorId?.name || "N/A"}</td>
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

            {/* Department overview */}
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Department Overview</h3>
              {departmentBreakdown.length === 0 ? (
                <p className={styles.emptyNote}>No departments created yet.</p>
              ) : (
                <ul className={styles.deptList}>
                  {departmentBreakdown.map((d) => (
                    <li key={d._id} className={styles.deptRow}>
                      <div className={styles.deptInfo}>
                        <span className={styles.deptName}>{d.name}</span>
                        <span className={styles.deptCode}>{d.code}</span>
                      </div>
                      <div className={styles.deptStats}>
                        <span>{d.students} students</span>
                        <span>{d.teams} teams</span>
                        <span>{d.projects} projects</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
