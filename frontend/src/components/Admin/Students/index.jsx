import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import {
  FaUserGraduate,
  FaLayerGroup,
  FaUserTie,
  FaProjectDiagram,
  FaSearch,
  FaTimes,
  FaEnvelope,
  FaBuilding,
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
  name ? name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";

const AllUserGroups = () => {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("teams"); // "teams" | "students"
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");

  const apiBase = process.env.REACT_APP_API_URL || "";
  const adminToken = localStorage.getItem("adminToken");
  const authHeader = { headers: { Authorization: `Bearer ${adminToken}` } };

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [usersRes, teamsRes, deptRes, projectsRes] = await Promise.all([
          axios.get(`${apiBase}/auth/users`),
          axios.get(`${apiBase}/auth/teams`),
          axios.get(`${apiBase}/auth/admin/department`, authHeader),
          axios.get(`${apiBase}/auth/admin/projects`, authHeader),
        ]);
        setUsers(usersRes.data || []);
        setTeams(teamsRes.data.teams || []);
        setDepartments(deptRes.data.departments || []);
        setProjects(projectsRes.data.projects || []);
      } catch (err) {
        console.error("Error fetching students/teams data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [apiBase]);

  const deptNameById = useMemo(() => {
    const map = {};
    departments.forEach((d) => { map[String(d._id)] = d.name; });
    return map;
  }, [departments]);

  // One row per team, enriched with its current project/supervisor (if any)
  const teamsList = useMemo(() => {
    return teams.map((team) => {
      const project = projects.find(
        (p) => String(p.teamId?._id || p.teamId) === String(team._id)
      );
      const members = (team.members || []).map((m) => ({
        _id: String(m._id || m),
        name: m.name || "Unknown",
        email: m.email || "",
        isLeader: String(team.createdBy) === String(m._id || m),
      }));

      return {
        teamId: team._id,
        subject: team.subject || "Untitled Team",
        department: team.department || "—",
        leaderName: team.creatorName || "N/A",
        members,
        projectTitle: project?.title || null,
        projectStatus: project?.status || null,
        progress: project?.progress || 0,
        supervisorName: project?.supervisorId?.name || null,
      };
    });
  }, [teams, projects]);

  // Every registered student, with derived team/role/department info
  const studentsList = useMemo(() => {
    return users.map((u) => {
      const userId = String(u._id);
      const userTeams = teamsList.filter((t) => t.members.some((m) => m._id === userId));
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        department: deptNameById[String(u.department)] || "—",
        isLeader: u.designation === "TeamLeader",
        teamSubjects: userTeams.map((t) => t.subject).join(", ") || "—",
      };
    });
  }, [users, teamsList, deptNameById]);

  const stats = useMemo(
    () => ({
      totalTeams: teamsList.length,
      totalStudents: studentsList.length,
      teamLeaders: studentsList.filter((s) => s.isLeader).length,
      activeProjects: projects.filter((p) => !["COMPLETED", "CANCELLED"].includes(p.status)).length,
    }),
    [teamsList, studentsList, projects]
  );

  const statusOptions = useMemo(() => {
    const present = new Set(teamsList.map((t) => t.projectStatus).filter(Boolean));
    return Array.from(present);
  }, [teamsList]);

  const deptOptions = useMemo(
    () => departments.map((d) => d.name).sort(),
    [departments]
  );

  const filteredTeams = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return teamsList.filter((t) => {
      if (statusFilter !== "ALL" && t.projectStatus !== statusFilter) return false;
      if (!term) return true;
      return (
        t.subject.toLowerCase().includes(term) ||
        t.leaderName.toLowerCase().includes(term) ||
        t.department.toLowerCase().includes(term) ||
        t.members.some(
          (m) => m.name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term)
        )
      );
    });
  }, [teamsList, searchTerm, statusFilter]);

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return studentsList.filter((s) => {
      if (roleFilter === "LEADER" && !s.isLeader) return false;
      if (roleFilter === "MEMBER" && s.isLeader) return false;
      if (deptFilter !== "ALL" && s.department !== deptFilter) return false;
      if (!term) return true;
      return (
        s.name?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term) ||
        s.teamSubjects.toLowerCase().includes(term)
      );
    });
  }, [studentsList, searchTerm, roleFilter, deptFilter]);

  const hasActiveFilters =
    searchTerm.trim() !== "" || statusFilter !== "ALL" || roleFilter !== "ALL" || deptFilter !== "ALL";
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setRoleFilter("ALL");
    setDeptFilter("ALL");
  };

  const switchView = (v) => {
    setView(v);
    setStatusFilter("ALL");
    setRoleFilter("ALL");
    setDeptFilter("ALL");
  };

  const noDataYet = !loading && teamsList.length === 0 && studentsList.length === 0;
  const noResults =
    !loading &&
    !noDataYet &&
    (view === "teams" ? filteredTeams.length === 0 : filteredStudents.length === 0);

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaUserGraduate /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Students &amp; Teams</h2>
          <p className={styles.subheading}>Every student and team registered across all departments.</p>
        </div>
      </div>

      {!loading && !noDataYet && (
        <>
          {/* Stats */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#dbeafe", color: "#1e40af" }}>
                <FaLayerGroup />
              </div>
              <div>
                <h4>Teams</h4>
                <p>{stats.totalTeams}</p>
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
              <div className={styles.statIcon} style={{ background: "#fef3c7", color: "#92400e" }}>
                <FaUserTie />
              </div>
              <div>
                <h4>Team Leaders</h4>
                <p>{stats.teamLeaders}</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#ede9fe", color: "#6d28d9" }}>
                <FaProjectDiagram />
              </div>
              <div>
                <h4>Active Projects</h4>
                <p>{stats.activeProjects}</p>
              </div>
            </div>
          </div>

          {/* View tabs */}
          <div className={styles.viewTabs}>
            <button
              className={`${styles.viewTab} ${view === "teams" ? styles.viewTabActive : ""}`}
              onClick={() => switchView("teams")}
            >
              <FaLayerGroup /> Teams <span className={styles.tabCount}>{teamsList.length}</span>
            </button>
            <button
              className={`${styles.viewTab} ${view === "students" ? styles.viewTabActive : ""}`}
              onClick={() => switchView("students")}
            >
              <FaUserGraduate /> Students <span className={styles.tabCount}>{studentsList.length}</span>
            </button>
          </div>

          {/* Search + filter */}
          <div className={styles.filterBar}>
            <div className={styles.searchBox}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder={
                  view === "teams"
                    ? "Search by team, leader, member, or department..."
                    : "Search by name, email, or team..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              {searchTerm && (
                <button
                  type="button"
                  className={styles.searchClearBtn}
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                >
                  <FaTimes />
                </button>
              )}
            </div>

            {view === "teams" ? (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.statusSelect}
              >
                <option value="ALL">All Statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                ))}
              </select>
            ) : (
              <>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className={styles.statusSelect}
                >
                  <option value="ALL">All Roles</option>
                  <option value="LEADER">Team Leaders</option>
                  <option value="MEMBER">Members</option>
                </select>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className={styles.statusSelect}
                >
                  <option value="ALL">All Departments</option>
                  {deptOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </>
            )}

            {hasActiveFilters && (
              <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>

          <p className={styles.resultsCount}>
            {view === "teams"
              ? `Showing ${filteredTeams.length} of ${teamsList.length} team${teamsList.length !== 1 ? "s" : ""}`
              : `Showing ${filteredStudents.length} of ${studentsList.length} student${studentsList.length !== 1 ? "s" : ""}`}
          </p>
        </>
      )}

      {loading ? (
        <p className={styles.emptyMsg}>Loading students and teams...</p>
      ) : noDataYet ? (
        <div className={styles.noResultsBox}>
          <div className={styles.emptyIconWrap}><FaLayerGroup /></div>
          <h4>No teams or students yet</h4>
          <p>Once students register and form teams, they'll show up here.</p>
        </div>
      ) : noResults ? (
        <div className={styles.noResultsBox}>
          <p className={styles.emptyMsg}>No {view} match your search/filter.</p>
          <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : view === "teams" ? (
        <div className={styles.teamGrid}>
          {filteredTeams.map((team) => {
            const sb = team.projectStatus
              ? STATUS_BADGE[team.projectStatus] || STATUS_BADGE.ACTIVE
              : null;
            return (
              <div key={team.teamId} className={styles.teamCard}>
                <div className={styles.teamCardHeader}>
                  <div className={styles.teamCardTitle}>{team.subject}</div>
                  {sb ? (
                    <span className={styles.badge} style={{ background: sb.bg, color: sb.color }}>
                      {STATUS_LABELS[team.projectStatus] || team.projectStatus}
                    </span>
                  ) : (
                    <span className={styles.badge} style={{ background: "#f3f4f6", color: "#9ca3af" }}>
                      No Project
                    </span>
                  )}
                </div>

                <div className={styles.teamPills}>
                  <span className={styles.deptPill}><FaBuilding /> {team.department}</span>
                  {team.supervisorName && (
                    <span className={styles.deptPill}><FaUserTie /> {team.supervisorName}</span>
                  )}
                </div>

                {team.projectTitle && (
                  <>
                    <div className={styles.teamProject}>{team.projectTitle}</div>
                    <div className={styles.progressWrap}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${team.progress}%` }} />
                      </div>
                      <span className={styles.progressText}>{team.progress}%</span>
                    </div>
                  </>
                )}

                <div className={styles.teamLeaderRow}>
                  <FaUserTie /> <strong>{team.leaderName}</strong>
                  <span className={styles.leaderTag}>Team Leader</span>
                </div>

                <div className={styles.memberChips}>
                  {team.members.map((m) => (
                    <span key={m._id} className={styles.memberChip} title={m.email}>
                      <span className={styles.memberAvatar}>{initials(m.name)}</span>
                      {m.name}
                      {m.isLeader && <span className={styles.crown}>★</span>}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Team(s)</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s._id}>
                  <td>
                    <div className={styles.studentNameCell}>
                      <span className={styles.memberAvatar}>{initials(s.name)}</span>
                      {s.name}
                    </div>
                  </td>
                  <td>
                    <span className={styles.emailCell}><FaEnvelope /> {s.email || "N/A"}</span>
                  </td>
                  <td>
                    {s.isLeader ? (
                      <span className={styles.badge} style={{ background: "#fef3c7", color: "#92400e" }}>
                        Team Leader
                      </span>
                    ) : (
                      <span className={styles.badge} style={{ background: "#f3f4f6", color: "#374151" }}>
                        Member
                      </span>
                    )}
                  </td>
                  <td>{s.department}</td>
                  <td>{s.teamSubjects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AllUserGroups;
