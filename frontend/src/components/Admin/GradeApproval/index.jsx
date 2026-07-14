import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../../Loader";
import { resolveFileUrl } from "../../../utils/resolveFileUrl";
import {
  FaStar,
  FaHourglassHalf,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSearch,
  FaTimes,
  FaFileCsv,
  FaFilePdf,
  FaBuilding,
} from "react-icons/fa";
import { exportToCSV, exportToPDF } from "../../../utils/exportUtils";

const TABS = ["PENDING_RELEASE", "RELEASED", "FLAGGED"];
const TAB_LABELS = {
  PENDING_RELEASE: "Pending Review",
  RELEASED: "Released",
  FLAGGED: "Flagged",
};

const GRADES_STATUS_LABELS = {
  PENDING_RELEASE: "Pending Admin Review",
  RELEASED: "Released",
  FLAGGED: "Flagged",
};

const letterGrade = (marks) =>
  marks >= 80 ? "A" : marks >= 70 ? "B" : marks >= 60 ? "C" : marks >= 50 ? "D" : "F";

// Flattens each project into one row per graded student (the unit that actually
// matters for a "grade report" — a project-level row would hide individual marks).
const buildGradeExportRows = (projects) => {
  const rows = [];
  projects.forEach((p) => {
    const grades = p.memberGrades?.length
      ? p.memberGrades
      : [{ name: "(no individual breakdown)", marks: p.evaluationMarks ?? 0 }];
    grades.forEach((g) => {
      rows.push({
        project: p.title,
        team: p.teamId?.subject || "N/A",
        supervisor: p.supervisorId?.name || "N/A",
        department: p.departmentId?.name || "N/A",
        student: g.name,
        marks: g.marks,
        grade: letterGrade(g.marks),
        gradesStatus: GRADES_STATUS_LABELS[p.gradesStatus] || p.gradesStatus,
        completedAt: p.completionDate ? new Date(p.completionDate).toLocaleDateString() : "N/A",
      });
    });
  });
  return rows;
};

const GRADE_EXPORT_COLUMNS = [
  { key: "project", label: "Project" },
  { key: "team", label: "Team" },
  { key: "student", label: "Student" },
  { key: "marks", label: "Marks (/100)" },
  { key: "grade", label: "Grade" },
  { key: "supervisor", label: "Supervisor" },
  { key: "department", label: "Department" },
  { key: "gradesStatus", label: "Status" },
  { key: "completedAt", label: "Completed" },
];

const GradeApproval = () => {
  const [projects, setProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]); // every project, any status — denominator for department completion
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("PENDING_RELEASE");
  const [flagModal, setFlagModal] = useState(null); // { projectId, title }
  const [flagReason, setFlagReason] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [toast, setToast] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const token = localStorage.getItem("adminToken");
  const apiBase = process.env.REACT_APP_API_URL || "";

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const fetchProjects = async () => {
    try {
      const [gradesRes, allRes] = await Promise.all([
        axios.get(`${apiBase}/auth/admin/projects/grades`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${apiBase}/auth/admin/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setProjects(gradesRes.data.projects || []);
      setAllProjects(allRes.data.projects || []);
    } catch (err) {
      console.error("Error fetching completed projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Per-department grading completion — total projects vs. how many have
  // had their grades released, so admin can see at a glance which
  // departments are fully done and ready for a report.
  const departmentStats = useMemo(() => {
    const byDept = new Map();
    allProjects.forEach((p) => {
      const name = p.departmentId?.name || "Unassigned";
      if (!byDept.has(name)) byDept.set(name, { name, total: 0, released: 0 });
      const entry = byDept.get(name);
      entry.total += 1;
      if (p.gradesStatus === "RELEASED") entry.released += 1;
    });
    return Array.from(byDept.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allProjects]);

  const generateDepartmentReport = (deptName) => {
    const deptRows = buildGradeExportRows(
      projects.filter((p) => (p.departmentId?.name || "Unassigned") === deptName && p.gradesStatus === "RELEASED")
    );

    if (deptRows.length === 0) {
      alert(`No released grades yet for ${deptName} — nothing to report.`);
      return;
    }

    const avg = (deptRows.reduce((sum, r) => sum + (r.marks || 0), 0) / deptRows.length).toFixed(1);
    const gradeCounts = deptRows.reduce((acc, r) => {
      acc[r.grade] = (acc[r.grade] || 0) + 1;
      return acc;
    }, {});
    const distribution = ["A", "B", "C", "D", "F"]
      .filter((g) => gradeCounts[g])
      .map((g) => `${g}: ${gradeCounts[g]}`)
      .join("   |   ");

    const stats = departmentStats.find((d) => d.name === deptName);
    const summaryLines = [
      `Total Students Graded: ${deptRows.length}`,
      `Average Marks: ${avg} / 100`,
      `Grade Distribution: ${distribution}`,
      stats && stats.released < stats.total
        ? `Note: ${stats.total - stats.released} project(s) in this department are not yet released and are excluded from this report.`
        : "All projects in this department have been graded and released.",
    ];

    exportToPDF(
      `${deptName.replace(/\s+/g, "-").toLowerCase()}-grade-report`,
      `${deptName} — Department Grade Report`,
      GRADE_EXPORT_COLUMNS.filter((c) => c.key !== "department" && c.key !== "gradesStatus"),
      deptRows,
      summaryLines
    );
  };

  const handleRelease = async (project) => {
    if (!window.confirm(`Release grades for "${project.title}"?\n\nStudents will be notified and can view their marks.`)) return;
    setActionLoading(project._id + "_release");
    try {
      await axios.put(
        `${apiBase}/auth/admin/projects/${project._id}/release-grades`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects((prev) =>
        prev.map((p) => p._id === project._id ? { ...p, gradesStatus: "RELEASED" } : p)
      );
      showToast(`Grades released for "${project.title}". Students can now view their marks.`);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to release grades.");
    } finally {
      setActionLoading("");
    }
  };

  const handleFlagSubmit = async () => {
    if (!flagReason.trim()) {
      alert("Please provide a reason for flagging.");
      return;
    }
    setActionLoading(flagModal.projectId + "_flag");
    try {
      await axios.put(
        `${apiBase}/auth/admin/projects/${flagModal.projectId}/flag-grades`,
        { flaggedReason: flagReason.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects((prev) =>
        prev.map((p) => p._id === flagModal.projectId ? { ...p, gradesStatus: "FLAGGED", flaggedReason: flagReason.trim() } : p)
      );
      showToast(`Project "${flagModal.title}" flagged. Supervisor has been notified.`);
      setFlagModal(null);
      setFlagReason("");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to flag project.");
    } finally {
      setActionLoading("");
    }
  };

  const counts = {
    PENDING_RELEASE: projects.filter((p) => p.gradesStatus === "PENDING_RELEASE").length,
    RELEASED: projects.filter((p) => p.gradesStatus === "RELEASED").length,
    FLAGGED: projects.filter((p) => p.gradesStatus === "FLAGGED").length,
  };

  const term = searchTerm.trim().toLowerCase();
  const filtered = projects.filter((p) => {
    if (p.gradesStatus !== activeTab) return false;
    if (!term) return true;
    return (
      p.title?.toLowerCase().includes(term) ||
      p.teamId?.subject?.toLowerCase().includes(term) ||
      p.supervisorId?.name?.toLowerCase().includes(term) ||
      p.departmentId?.name?.toLowerCase().includes(term)
    );
  });

  const hasActiveFilters = searchTerm.trim() !== "";
  const clearFilters = () => setSearchTerm("");

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaStar /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Grade Approval</h2>
          <p className={styles.subheading}>
            Review supervisor-assigned grades before releasing them to students.
          </p>
        </div>
      </div>

      {!loading && departmentStats.length > 0 && (
        <div className={styles.deptPanel}>
          <h3 className={styles.deptPanelTitle}><FaBuilding /> Department Grading Status</h3>
          <div className={styles.deptList}>
            {departmentStats.map((d) => {
              const fullyDone = d.total > 0 && d.released === d.total;
              return (
                <div key={d.name} className={styles.deptRow}>
                  <div className={styles.deptRowInfo}>
                    <span className={styles.deptRowName}>{d.name}</span>
                    <span className={`${styles.deptRowBadge} ${fullyDone ? styles.deptRowBadgeDone : styles.deptRowBadgePending}`}>
                      {fullyDone ? "Fully Released" : "In Progress"}
                    </span>
                  </div>
                  <span className={styles.deptRowCount}>{d.released}/{d.total} released</span>
                  <button
                    type="button"
                    className={styles.deptReportBtn}
                    onClick={() => generateDepartmentReport(d.name)}
                    disabled={d.released === 0}
                    title={d.released === 0 ? "No released grades yet for this department" : "Generate department grade report"}
                  >
                    <FaFilePdf /> Generate Report
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#fef3c7", color: "#92400e" }}>
              <FaHourglassHalf />
            </div>
            <div>
              <h4>Pending Review</h4>
              <p>{counts.PENDING_RELEASE}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#dcfce7", color: "#15803d" }}>
              <FaCheckCircle />
            </div>
            <div>
              <h4>Released</h4>
              <p>{counts.RELEASED}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#fee2e2", color: "#b91c1c" }}>
              <FaExclamationTriangle />
            </div>
            <div>
              <h4>Flagged</h4>
              <p>{counts.FLAGGED}</p>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Flag Modal */}
      {flagModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Flag for Re-grading</h3>
            <p className={styles.modalSubtitle}>{flagModal.title}</p>
            <label className={styles.label}>Reason (required):</label>
            <textarea
              className={styles.textarea}
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Explain why these grades need to be revised by the supervisor..."
              rows={4}
            />
            <div className={styles.modalActions}>
              <button
                className={styles.flagBtn}
                onClick={handleFlagSubmit}
                disabled={!!actionLoading}
              >
                {actionLoading ? "Flagging..." : "Flag & Notify Supervisor"}
              </button>
              <button
                className={styles.cancelBtn}
                onClick={() => { setFlagModal(null); setFlagReason(""); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
            {counts[tab] > 0 && (
              <span className={`${styles.badge} ${tab === "FLAGGED" ? styles.badgeRed : tab === "RELEASED" ? styles.badgeGreen : styles.badgeOrange}`}>
                {counts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      {!loading && projects.length > 0 && (
        <>
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
            {hasActiveFilters && (
              <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
          <div className={styles.resultsRow}>
            <p className={styles.resultsCount}>
              Showing {filtered.length} of {counts[activeTab]} in "{TAB_LABELS[activeTab]}"
            </p>
            <div className={styles.exportGroup}>
              <button
                type="button"
                className={styles.exportBtn}
                disabled={filtered.length === 0}
                onClick={() =>
                  exportToCSV("grades-report", GRADE_EXPORT_COLUMNS, buildGradeExportRows(filtered))
                }
              >
                <FaFileCsv /> CSV
              </button>
              <button
                type="button"
                className={styles.exportBtn}
                disabled={filtered.length === 0}
                onClick={() =>
                  exportToPDF(
                    "grades-report",
                    `Grades Report — ${TAB_LABELS[activeTab]}`,
                    GRADE_EXPORT_COLUMNS,
                    buildGradeExportRows(filtered)
                  )
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
      ) : filtered.length === 0 ? (
        <div className={styles.emptyBox}>
          <p className={styles.emptyMsg}>
            {hasActiveFilters ? (
              "No projects match your search."
            ) : (
              <>
                {activeTab === "PENDING_RELEASE" && "No projects awaiting grade review."}
                {activeTab === "RELEASED" && "No grades have been released yet."}
                {activeTab === "FLAGGED" && "No projects are currently flagged."}
              </>
            )}
          </p>
          {hasActiveFilters && (
            <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters} style={{ marginTop: "12px" }}>
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {filtered.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              activeTab={activeTab}
              actionLoading={actionLoading}
              onRelease={handleRelease}
              onFlag={(p) => { setFlagModal({ projectId: p._id, title: p.title }); setFlagReason(""); }}
              apiBase={apiBase}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectCard = ({ project, activeTab, actionLoading, onRelease, onFlag, apiBase }) => {
  const [expanded, setExpanded] = useState(false);

  const avgMarks = project.evaluationMarks ?? (
    project.memberGrades?.length
      ? Math.round(project.memberGrades.reduce((s, g) => s + g.marks, 0) / project.memberGrades.length)
      : 0
  );

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>{project.title}</h3>
          <p className={styles.cardMeta}>
            <span>Team: <strong>{project.teamId?.subject || "N/A"}</strong></span>
            <span>Supervisor: <strong>{project.supervisorId?.name || "N/A"}</strong></span>
            <span>Dept: <strong>{project.departmentId?.name || "N/A"}</strong></span>
          </p>
          {project.completionDate && (
            <p className={styles.dateLabel}>
              Completed: {new Date(project.completionDate).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className={styles.avgBadge}>
          <span className={styles.avgNumber}>{avgMarks}</span>
          <span className={styles.avgLabel}>/100 avg</span>
        </div>
      </div>

      {/* Flagged reason */}
      {activeTab === "FLAGGED" && project.flaggedReason && (
        <div className={styles.flaggedBox}>
          <strong>Flagged reason:</strong> {project.flaggedReason}
        </div>
      )}

      {/* Admin remarks on released */}
      {activeTab === "RELEASED" && project.adminRemarks && (
        <div className={styles.remarksBox}>
          <strong>Admin remarks:</strong> {project.adminRemarks}
        </div>
      )}

      {/* Member grades toggle */}
      <button className={styles.toggleBtn} onClick={() => setExpanded((v) => !v)}>
        {expanded ? "Hide" : "View"} Member Grades ({project.memberGrades?.length || 0} members)
      </button>

      {expanded && (
        <div className={styles.gradesTable}>
          {!project.memberGrades?.length ? (
            <p className={styles.noGrades}>No individual grades recorded.</p>
          ) : (
            <>
              <div className={styles.gradesHeader}>
                <span>Student</span><span>Marks</span><span>Grade</span>
              </div>
              {project.memberGrades.map((g, i) => {
                const letter = g.marks >= 80 ? "A" : g.marks >= 70 ? "B" : g.marks >= 60 ? "C" : g.marks >= 50 ? "D" : "F";
                const gradeColor = g.marks >= 80 ? "#2e7d32" : g.marks >= 70 ? "#1565c0" : g.marks >= 60 ? "#e65100" : g.marks >= 50 ? "#d97706" : "#c62828";
                return (
                  <div key={i}>
                    <div className={styles.gradeRow}>
                      <span className={styles.studentName}>{g.name}</span>
                      <span className={styles.marksVal}>{g.marks}/100</span>
                      <span className={styles.letterGrade} style={{ color: gradeColor }}>{letter}</span>
                    </div>
                    {g.rubricScores?.length > 0 && (
                      <div className={styles.rubricBreakdown}>
                        {g.rubricScores.map((rs, j) => (
                          <div key={j} className={styles.rubricBreakdownRow}>
                            <span className={styles.rbCriterion}>{rs.criterionName}</span>
                            <span className={styles.rbMeta}>{rs.score}/100 × {rs.weight}% = <strong>{((rs.score * rs.weight) / 100).toFixed(1)} pts</strong></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className={styles.gradeRowAvg}>
                <span>Average</span>
                <span>{avgMarks}/100</span>
                <span></span>
              </div>
            </>
          )}
          {project.finalReportUrl && (
            <a
              href={resolveFileUrl(project.finalReportUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.reportLink}
            >
              View Final Report (PDF)
            </a>
          )}
        </div>
      )}

      {/* Supervisor remarks */}
      {project.remarks && (
        <p className={styles.supervisorRemarks}>
          <strong>Supervisor remarks:</strong> {project.remarks}
        </p>
      )}

      {/* Actions */}
      {activeTab === "PENDING_RELEASE" && (
        <div className={styles.cardActions}>
          <button
            className={styles.releaseBtn}
            onClick={() => onRelease(project)}
            disabled={!!actionLoading}
          >
            {actionLoading === project._id + "_release" ? "Releasing..." : "Release Grades"}
          </button>
          <button
            className={styles.flagBtn}
            onClick={() => onFlag(project)}
            disabled={!!actionLoading}
          >
            Flag for Re-grading
          </button>
        </div>
      )}

      {activeTab === "RELEASED" && (
        <div className={styles.releasedBadge}>
          Grades Released
        </div>
      )}

      {activeTab === "FLAGGED" && (
        <div className={styles.flaggedBadge}>
          Awaiting Supervisor Re-grading
        </div>
      )}
    </div>
  );
};

export default GradeApproval;
