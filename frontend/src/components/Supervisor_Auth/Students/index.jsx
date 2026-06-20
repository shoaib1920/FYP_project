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
} from "react-icons/fa";

const STATUS_LABEL = {
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
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("teams"); // "teams" | "students"
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const apiBase = process.env.REACT_APP_API_URL || "";
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get(`${apiBase}/auth/projects/supervisor`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProjects(res.data.projects || []);
      } catch (err) {
        console.error("Error fetching supervisor projects:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [apiBase, token]);

  // One row per team I supervise (deduped by team id)
  const teams = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => {
      const team = p.teamId;
      if (!team || !team._id || map.has(team._id)) return;

      const leaderId = p.teamLeaderId?._id ? String(p.teamLeaderId._id) : null;
      const members = (team.members || []).map((m) => ({
        _id: String(m._id || m),
        name: m.name || "Unknown",
        email: m.email || "",
        isLeader: leaderId === String(m._id || m),
      }));

      map.set(team._id, {
        teamId: team._id,
        subject: team.subject || "Untitled Team",
        leaderName: p.teamLeaderId?.name || "N/A",
        leaderEmail: p.teamLeaderId?.email || "",
        members,
        projectTitle: p.title,
        projectStatus: p.status,
        progress: p.progress || 0,
      });
    });
    return Array.from(map.values());
  }, [projects]);

  // One row per unique student across all my teams
  const students = useMemo(() => {
    const map = new Map();
    teams.forEach((team) => {
      team.members.forEach((m) => {
        if (!map.has(m._id)) {
          map.set(m._id, {
            _id: m._id,
            name: m.name,
            email: m.email,
            isLeaderAnywhere: m.isLeader,
            teamSubjects: new Set([team.subject]),
          });
        } else {
          const existing = map.get(m._id);
          existing.teamSubjects.add(team.subject);
          existing.isLeaderAnywhere = existing.isLeaderAnywhere || m.isLeader;
        }
      });
    });
    return Array.from(map.values()).map((s) => ({
      ...s,
      teamSubjects: Array.from(s.teamSubjects).join(", "),
    }));
  }, [teams]);

  const stats = useMemo(
    () => ({
      totalTeams: teams.length,
      totalStudents: students.length,
      teamLeaders: students.filter((s) => s.isLeaderAnywhere).length,
      activeProjects: teams.filter((t) => !["COMPLETED", "CANCELLED"].includes(t.projectStatus)).length,
    }),
    [teams, students]
  );

  const statusOptions = useMemo(() => {
    const present = new Set(teams.map((t) => t.projectStatus).filter(Boolean));
    return Array.from(present);
  }, [teams]);

  const filteredTeams = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return teams.filter((t) => {
      if (statusFilter !== "ALL" && t.projectStatus !== statusFilter) return false;
      if (!term) return true;
      return (
        t.subject.toLowerCase().includes(term) ||
        t.leaderName.toLowerCase().includes(term) ||
        t.members.some(
          (m) => m.name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term)
        )
      );
    });
  }, [teams, searchTerm, statusFilter]);

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return students.filter((s) => {
      if (roleFilter === "LEADER" && !s.isLeaderAnywhere) return false;
      if (roleFilter === "MEMBER" && s.isLeaderAnywhere) return false;
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.teamSubjects.toLowerCase().includes(term)
      );
    });
  }, [students, searchTerm, roleFilter]);

  const hasActiveFilters = searchTerm.trim() !== "" || statusFilter !== "ALL" || roleFilter !== "ALL";
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setRoleFilter("ALL");
  };

  const switchView = (v) => {
    setView(v);
    setStatusFilter("ALL");
    setRoleFilter("ALL");
  };

  const noDataYet = !loading && teams.length === 0;
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
          <h2 className={styles.heading}>My Students &amp; Teams</h2>
          <p className={styles.subheading}>Everyone you're currently supervising, in one place.</p>
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
              <FaLayerGroup /> Teams <span className={styles.tabCount}>{teams.length}</span>
            </button>
            <button
              className={`${styles.viewTab} ${view === "students" ? styles.viewTabActive : ""}`}
              onClick={() => switchView("students")}
            >
              <FaUserGraduate /> Students <span className={styles.tabCount}>{students.length}</span>
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
                    ? "Search by team, leader, or member..."
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
                  <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
                ))}
              </select>
            ) : (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={styles.statusSelect}
              >
                <option value="ALL">All Roles</option>
                <option value="LEADER">Team Leaders</option>
                <option value="MEMBER">Members</option>
              </select>
            )}

            {hasActiveFilters && (
              <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>

          <p className={styles.resultsCount}>
            {view === "teams"
              ? `Showing ${filteredTeams.length} of ${teams.length} team${teams.length !== 1 ? "s" : ""}`
              : `Showing ${filteredStudents.length} of ${students.length} student${students.length !== 1 ? "s" : ""}`}
          </p>
        </>
      )}

      {loading ? (
        <p className={styles.emptyMsg}>Loading your students and teams...</p>
      ) : noDataYet ? (
        <div className={styles.noResultsBox}>
          <div className={styles.emptyIconWrap}><FaLayerGroup /></div>
          <h4>No teams assigned yet</h4>
          <p>Once a proposal is accepted, the team and its members will show up here.</p>
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
            const sb = STATUS_BADGE[team.projectStatus] || STATUS_BADGE.ACTIVE;
            return (
              <div key={team.teamId} className={styles.teamCard}>
                <div className={styles.teamCardHeader}>
                  <div className={styles.teamCardTitle}>{team.subject}</div>
                  <span className={styles.badge} style={{ background: sb.bg, color: sb.color }}>
                    {STATUS_LABEL[team.projectStatus] || team.projectStatus}
                  </span>
                </div>

                <div className={styles.teamProject}>{team.projectTitle}</div>

                <div className={styles.progressWrap}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${team.progress}%` }} />
                  </div>
                  <span className={styles.progressText}>{team.progress}%</span>
                </div>

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
                    {s.isLeaderAnywhere ? (
                      <span className={styles.badge} style={{ background: "#fef3c7", color: "#92400e" }}>
                        Team Leader
                      </span>
                    ) : (
                      <span className={styles.badge} style={{ background: "#f3f4f6", color: "#374151" }}>
                        Member
                      </span>
                    )}
                  </td>
                  <td>{s.teamSubjects || "—"}</td>
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
