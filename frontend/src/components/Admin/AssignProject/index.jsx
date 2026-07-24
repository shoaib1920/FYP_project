import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../../Loader";
import { resolveFileUrl } from "../../../utils/resolveFileUrl";
import {
  FaProjectDiagram,
  FaHourglassHalf,
  FaClipboardCheck,
  FaCheckCircle,
  FaSearch,
  FaTimes,
  FaUserTie,
  FaBuilding,
  FaGithub,
  FaUserGraduate,
  FaPlayCircle,
  FaFileCsv,
  FaFilePdf,
} from "react-icons/fa";
import LivePreview from "../../LivePreview";
import ProjectDocumentsModal from "../../ProjectDocumentsModal";
import { exportToCSV, exportToPDF } from "../../../utils/exportUtils";

const EXPORT_COLUMNS = [
  { key: "title", label: "Title" },
  { key: "team", label: "Team", value: (p) => p.teamId?.subject || "N/A" },
  { key: "supervisor", label: "Supervisor", value: (p) => p.supervisorId?.name || "N/A" },
  { key: "department", label: "Department", value: (p) => p.departmentId?.name || "N/A" },
  { key: "status", label: "Status", value: (p) => STATUS_LABELS[p.status] || p.status },
  { key: "progress", label: "Progress", value: (p) => `${p.progress || 0}%` },
];

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

const AdminProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [supervisorFilter, setSupervisorFilter] = useState("ALL");
  const [selectedProject, setSelectedProject] = useState(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const apiBase = process.env.REACT_APP_API_URL || "";
  const adminToken = localStorage.getItem("adminToken");
  const authHeader = { headers: { Authorization: `Bearer ${adminToken}` } };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get(`${apiBase}/auth/admin/projects`, authHeader);
        setProjects(res.data.projects || []);
      } catch (err) {
        console.error("Error fetching projects:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const counts = { total: projects.length, active: 0, underReview: 0, completed: 0 };
    projects.forEach((p) => {
      if (["ACTIVE", "IN_PROGRESS", "ON_HOLD"].includes(p.status)) counts.active += 1;
      if (p.status === "UNDER_REVIEW") counts.underReview += 1;
      if (p.status === "COMPLETED") counts.completed += 1;
    });
    return counts;
  }, [projects]);

  const deptOptions = useMemo(() => {
    const names = new Set(projects.map((p) => p.departmentId?.name).filter(Boolean));
    return Array.from(names).sort();
  }, [projects]);

  const supervisorOptions = useMemo(() => {
    const names = new Set(projects.map((p) => p.supervisorId?.name).filter(Boolean));
    return Array.from(names).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (deptFilter !== "ALL" && p.departmentId?.name !== deptFilter) return false;
      if (supervisorFilter !== "ALL" && p.supervisorId?.name !== supervisorFilter) return false;
      if (!term) return true;
      return (
        p.title?.toLowerCase().includes(term) ||
        p.teamId?.subject?.toLowerCase().includes(term) ||
        p.supervisorId?.name?.toLowerCase().includes(term) ||
        p.departmentId?.name?.toLowerCase().includes(term)
      );
    });
  }, [projects, searchTerm, statusFilter, deptFilter, supervisorFilter]);

  const hasActiveFilters =
    searchTerm.trim() !== "" || statusFilter !== "ALL" || deptFilter !== "ALL" || supervisorFilter !== "ALL";
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setDeptFilter("ALL");
    setSupervisorFilter("ALL");
  };

  const noDataYet = !loading && projects.length === 0;
  const noResults = !loading && !noDataYet && filteredProjects.length === 0;

  const buildMemberList = (project) => {
    const seen = new Set();
    const members = [];
    const add = (m) => {
      if (!m) return;
      const id = String(m._id || m);
      if (seen.has(id)) return;
      seen.add(id);
      members.push({ _id: id, name: m.name || "Unknown" });
    };
    if (project.teamLeaderId) add(project.teamLeaderId);
    if (Array.isArray(project.teamId?.members)) project.teamId.members.forEach(add);
    if (project.teamId?.createdBy) add(project.teamId.createdBy);
    return members;
  };

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaProjectDiagram /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>All Projects</h2>
          <p className={styles.subheading}>Monitor every FYP project across the system.</p>
        </div>
      </div>

      {!loading && !noDataYet && (
        <>
          {/* Stats */}
          <div className={styles.statsRow}>
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
              <div className={styles.statIcon} style={{ background: "#e3f2fd", color: "#1565c0" }}>
                <FaHourglassHalf />
              </div>
              <div>
                <h4>Active</h4>
                <p>{stats.active}</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#f3e5f5", color: "#6a1b9a" }}>
                <FaClipboardCheck />
              </div>
              <div>
                <h4>Under Review</h4>
                <p>{stats.underReview}</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                <FaCheckCircle />
              </div>
              <div>
                <h4>Completed</h4>
                <p>{stats.completed}</p>
              </div>
            </div>
          </div>

          {/* Search + filter */}
          <div className={styles.filterBar}>
            <div className={styles.searchBox}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by project, team, supervisor, or department..."
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

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.statusSelect}>
              <option value="ALL">All Statuses</option>
              {Object.keys(STATUS_LABELS).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>

            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={styles.statusSelect}>
              <option value="ALL">All Departments</option>
              {deptOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <select value={supervisorFilter} onChange={(e) => setSupervisorFilter(e.target.value)} className={styles.statusSelect}>
              <option value="ALL">All Supervisors</option>
              {supervisorOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>

          <div className={styles.resultsRow}>
            <p className={styles.resultsCount}>
              Showing {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
            <div className={styles.exportGroup}>
              <button
                type="button"
                className={styles.exportBtn}
                disabled={filteredProjects.length === 0}
                onClick={() =>
                  exportToCSV("fyp-projects", EXPORT_COLUMNS, filteredProjects)
                }
              >
                <FaFileCsv /> CSV
              </button>
              <button
                type="button"
                className={styles.exportBtn}
                disabled={filteredProjects.length === 0}
                onClick={() =>
                  exportToPDF("fyp-projects", "FYP Projects Report", EXPORT_COLUMNS, filteredProjects)
                }
              >
                <FaFilePdf /> PDF
              </button>
            </div>
          </div>
        </>
      )}

      {loading ? (
        <Loader text="Loading projects..." />
      ) : noDataYet ? (
        <div className={styles.noResultsBox}>
          <div className={styles.emptyIconWrap}><FaProjectDiagram /></div>
          <h4>No projects yet</h4>
          <p>Once a proposal is accepted by a supervisor, the project will show up here.</p>
        </div>
      ) : noResults ? (
        <div className={styles.noResultsBox}>
          <p className={styles.emptyMsg}>No projects match your search/filter.</p>
          <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Team</th>
                <th>Supervisor</th>
                <th>Department</th>
                <th>Progress</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const sc = STATUS_BADGE[project.status] || STATUS_BADGE.ACTIVE;
                return (
                  <tr key={project._id} onClick={() => setSelectedProject(project)} className={styles.clickableRow}>
                    <td className={styles.titleCell}>{project.title}</td>
                    <td>{project.teamId?.subject || "N/A"}</td>
                    <td>{project.supervisorId?.name || "N/A"}</td>
                    <td>{project.departmentId?.name || "N/A"}</td>
                    <td>
                      <div className={styles.progressWrap}>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${project.progress || 0}%` }} />
                        </div>
                        <span className={styles.progressText}>{project.progress || 0}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.badge} style={{ background: sc.bg, color: sc.color }}>
                        {STATUS_LABELS[project.status] || project.status}
                      </span>
                    </td>
                    <td className={styles.viewCell}>View →</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedProject && (
        <div className={styles.backdrop} onClick={() => setSelectedProject(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTopBar}>
              <h2>{selectedProject.title}</h2>
              <button onClick={() => setSelectedProject(null)} className={styles.closeBtn}>✖</button>
            </div>

            <span
              className={styles.badge}
              style={{
                background: (STATUS_BADGE[selectedProject.status] || STATUS_BADGE.ACTIVE).bg,
                color: (STATUS_BADGE[selectedProject.status] || STATUS_BADGE.ACTIVE).color,
              }}
            >
              {STATUS_LABELS[selectedProject.status] || selectedProject.status}
            </span>

            {selectedProject.abstract && (
              <div className={styles.sectionBlock}>
                <h3>Abstract</h3>
                <p>{selectedProject.abstract}</p>
              </div>
            )}

            {selectedProject.objectives && (
              <div className={styles.sectionBlock}>
                <h3>Objectives</h3>
                <p>{selectedProject.objectives}</p>
              </div>
            )}

            {selectedProject.technologies && (
              <div className={styles.sectionBlock}>
                <h3>Technologies</h3>
                <p>{selectedProject.technologies}</p>
              </div>
            )}

            <div className={styles.sectionBlock}>
              <h3><FaUserTie /> Supervisor</h3>
              <p>{selectedProject.supervisorId?.name || "N/A"}</p>
            </div>

            <div className={styles.sectionBlock}>
              <h3><FaBuilding /> Department</h3>
              <p>{selectedProject.departmentId?.name || "N/A"}</p>
            </div>

            <div className={styles.sectionBlock}>
              <h3><FaUserGraduate /> Team — {selectedProject.teamId?.subject || "N/A"}</h3>
              <ul className={styles.memberList}>
                {buildMemberList(selectedProject).map((m) => (
                  <li key={m._id}>{m.name}</li>
                ))}
              </ul>
            </div>

            <div className={styles.sectionBlock}>
              <h3>Links</h3>
              {selectedProject.githubRepository ? (
                <a href={selectedProject.githubRepository} target="_blank" rel="noopener noreferrer" className={styles.linkRow}>
                  <FaGithub /> Repository
                </a>
              ) : (
                <p className={styles.linkMissingNote}>⚠️ No GitHub repository shared yet.</p>
              )}
              {selectedProject.deploymentLink ? (
                <button
                  type="button"
                  className={styles.viewLiveLinkBtn}
                  onClick={() => setPreviewUrl(selectedProject.deploymentLink)}
                >
                  <FaPlayCircle /> View Live
                </button>
              ) : (
                <p className={styles.linkMissingNote}>Live link not shared.</p>
              )}
            </div>

            {selectedProject.finalReportUrl && (
              <div className={styles.sectionBlock}>
                <h3>Final Report</h3>
                <a
                  href={resolveFileUrl(selectedProject.finalReportUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkRow}
                >
                  View PDF
                </a>
              </div>
            )}

            <div className={styles.sectionBlock}>
              <button
                type="button"
                onClick={() => setShowDocuments(true)}
                style={{
                  background: "#eff6ff", border: "1px solid #dbeafe", color: "#1e40af",
                  borderRadius: "8px", padding: "8px 14px", fontSize: "13px", fontWeight: "700", cursor: "pointer",
                }}
              >
                View All Project Documents
              </button>
            </div>
          </div>
        </div>
      )}

      {showDocuments && selectedProject && (
        <ProjectDocumentsModal
          projectId={selectedProject._id}
          tokenKey="adminToken"
          onClose={() => setShowDocuments(false)}
        />
      )}

      {previewUrl && (
        <LivePreview url={previewUrl} title="Live Project Preview" onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  );
};

export default AdminProjects;
