import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import { resolveFileUrl } from "../../../utils/resolveFileUrl";
import { generateCompletionCertificate } from "../../../utils/certificateUtils";
import {
  FaFolderOpen,
  FaProjectDiagram,
  FaHourglassHalf,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSearch,
  FaTimes,
  FaGithub,
  FaPlayCircle,
  FaCalendarWeek,
  FaMarker,
  FaHistory,
  FaAward,
} from "react-icons/fa";
import LivePreview from "../../LivePreview";
import LiveReviewModal from "../../LiveReviewModal";

const STATUS_COLORS = {
  ACTIVE:       { bg: "#f3f4f6", color: "#374151" },
  IN_PROGRESS:  { bg: "#e3f2fd", color: "#1565c0" },
  ON_HOLD:      { bg: "#fff3e0", color: "#e65100" },
  UNDER_REVIEW: { bg: "#f3e5f5", color: "#6a1b9a" },
  COMPLETED:    { bg: "#e8f5e9", color: "#2e7d32" },
  CANCELLED:    { bg: "#fce4ec", color: "#c62828" },
};

const STATUS_LABEL = {
  ACTIVE: "Active",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  UNDER_REVIEW: "Under Review",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const GRADES_STATUS_COLORS = {
  PENDING_RELEASE: { bg: "#fef3c7", color: "#92400e", label: "Pending Admin Review" },
  RELEASED:        { bg: "#d1fae5", color: "#065f46", label: "Grades Released" },
  FLAGGED:         { bg: "#fee2e2", color: "#991b1b", label: "Flagged — Re-grade Required" },
};

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

const FYPProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gradeModal, setGradeModal] = useState(null); // { projectId, title, members, isRegrade }
  const [memberGrades, setMemberGrades] = useState({});
  const [evalRemarks, setEvalRemarks] = useState("");
  const [completing, setCompleting] = useState(false);
  const [toast, setToast] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [gradesFilter, setGradesFilter] = useState("ALL");
  const [previewUrl, setPreviewUrl] = useState(null);

  const [progressModalProject, setProgressModalProject] = useState(null);
  const [progressLogs, setProgressLogs] = useState([]);
  const [progressLogsLoading, setProgressLogsLoading] = useState(false);
  const [feedbackDrafts, setFeedbackDrafts] = useState({});
  const [savingFeedbackId, setSavingFeedbackId] = useState(null);

  const [reviewProject, setReviewProject] = useState(null); // project being live-reviewed (annotation tool)

  const [historyProject, setHistoryProject] = useState(null); // project whose review history is open
  const [reviewHistory, setReviewHistory] = useState([]);
  const [reviewHistoryLoading, setReviewHistoryLoading] = useState(false);

  const token = localStorage.getItem("token");
  const apiBase = process.env.REACT_APP_API_URL || "";

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

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

  useEffect(() => { fetchProjects(); }, []);

  const fetchProgressLogs = async (projectId) => {
    setProgressLogsLoading(true);
    try {
      const res = await axios.get(
        `${apiBase}/auth/progress-logs/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProgressLogs(res.data.logs || []);
    } catch (err) {
      console.error("Error fetching progress logs:", err);
      setProgressLogs([]);
    } finally {
      setProgressLogsLoading(false);
    }
  };

  const handleOpenProgressModal = (project) => {
    setProgressModalProject(project);
    setFeedbackDrafts({});
    fetchProgressLogs(project._id);
  };

  const fetchReviewHistory = async (projectId) => {
    setReviewHistoryLoading(true);
    try {
      const res = await axios.get(
        `${apiBase}/auth/review-notes/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReviewHistory(res.data.reviewNotes || []);
    } catch (err) {
      console.error("Error fetching review history:", err);
      setReviewHistory([]);
    } finally {
      setReviewHistoryLoading(false);
    }
  };

  const handleOpenHistoryModal = (project) => {
    setHistoryProject(project);
    fetchReviewHistory(project._id);
  };

  const handleSendFeedback = async (logId) => {
    const text = (feedbackDrafts[logId] || "").trim();
    if (!text) {
      alert("Please write feedback before sending.");
      return;
    }
    setSavingFeedbackId(logId);
    try {
      await axios.put(
        `${apiBase}/auth/progress-logs/${logId}/review`,
        { supervisorFeedback: text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchProgressLogs(progressModalProject._id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send feedback.");
    } finally {
      setSavingFeedbackId(null);
    }
  };

  const stats = useMemo(() => {
    const counts = { total: projects.length, active: 0, underReview: 0, completed: 0, flagged: 0 };
    projects.forEach((p) => {
      if (["ACTIVE", "IN_PROGRESS", "ON_HOLD"].includes(p.status)) counts.active += 1;
      if (p.status === "UNDER_REVIEW") counts.underReview += 1;
      if (p.status === "COMPLETED") counts.completed += 1;
      if (p.gradesStatus === "FLAGGED") counts.flagged += 1;
    });
    return counts;
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (gradesFilter !== "ALL" && p.gradesStatus !== gradesFilter) return false;
      if (!term) return true;
      return (
        p.title?.toLowerCase().includes(term) ||
        p.teamId?.subject?.toLowerCase().includes(term) ||
        p.teamLeaderId?.name?.toLowerCase().includes(term)
      );
    });
  }, [projects, searchTerm, statusFilter, gradesFilter]);

  const hasActiveFilters = searchTerm.trim() !== "" || statusFilter !== "ALL" || gradesFilter !== "ALL";
  const clearFilters = () => { setSearchTerm(""); setStatusFilter("ALL"); setGradesFilter("ALL"); };

  const openGradeModal = (project, isRegrade = false) => {
    const members = buildMemberList(project);
    const initialGrades = {};
    members.forEach((m) => {
      const existing = project.memberGrades?.find((g) => String(g.userId) === m._id);
      initialGrades[m._id] = existing ? String(existing.marks) : "";
    });
    setGradeModal({ projectId: project._id, title: project.title, members, isRegrade, flaggedReason: project.flaggedReason });
    setMemberGrades(initialGrades);
    setEvalRemarks(project.remarks || "");
  };

  const setGrade = (id, val) => setMemberGrades((prev) => ({ ...prev, [id]: val }));

  const handleSubmitGrades = async () => {
    const { members, projectId, title, isRegrade } = gradeModal;

    for (const m of members) {
      const num = Number(memberGrades[m._id]);
      if (memberGrades[m._id] === "" || isNaN(num) || num < 0 || num > 100) {
        alert(`Please enter valid marks (0–100) for "${m.name}".`);
        return;
      }
    }

    const gradesArray = members.map((m) => ({
      userId: m._id,
      name: m.name,
      marks: Number(memberGrades[m._id]),
    }));
    const avgMarks = Math.round(gradesArray.reduce((s, g) => s + g.marks, 0) / gradesArray.length);

    setCompleting(true);
    try {
      const endpoint = isRegrade
        ? `${apiBase}/auth/projects/${projectId}/regrade`
        : `${apiBase}/auth/projects/${projectId}/complete`;

      await axios.put(
        endpoint,
        { evaluationMarks: avgMarks, remarks: evalRemarks, memberGrades: gradesArray },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast(
        isRegrade
          ? `Re-grading submitted for "${title}". Waiting for admin approval.`
          : `Project "${title}" graded and marked complete. Avg: ${avgMarks}/100.`
      );
      setGradeModal(null);
      setProjects((prev) =>
        prev.map((p) =>
          p._id === projectId
            ? {
                ...p,
                status: "COMPLETED",
                progress: 100,
                evaluationMarks: avgMarks,
                memberGrades: gradesArray,
                gradesStatus: "PENDING_RELEASE",
                flaggedReason: "",
              }
            : p
        )
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to submit grades.");
    } finally {
      setCompleting(false);
    }
  };

  const allFilled = gradeModal?.members?.every(
    (m) => memberGrades[m._id] !== "" && !isNaN(Number(memberGrades[m._id]))
  ) ?? false;

  const liveAvg =
    allFilled && gradeModal?.members?.length
      ? Math.round(
          gradeModal.members.reduce((s, m) => s + Number(memberGrades[m._id] || 0), 0) /
            gradeModal.members.length
        )
      : null;

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaFolderOpen /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>FYP Projects</h2>
          <p className={styles.subheading}>Track, grade, and manage every project assigned to you.</p>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {!loading && projects.length > 0 && (
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
                <FaExclamationTriangle />
              </div>
              <div>
                <h4>Awaiting Your Review</h4>
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
                placeholder="Search by project title, team, or team leader..."
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

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.statusSelect}
            >
              <option value="ALL">All Statuses</option>
              {Object.keys(STATUS_LABEL).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>

            <select
              value={gradesFilter}
              onChange={(e) => setGradesFilter(e.target.value)}
              className={styles.statusSelect}
            >
              <option value="ALL">All Grade Statuses</option>
              {Object.keys(GRADES_STATUS_COLORS).map((s) => (
                <option key={s} value={s}>{GRADES_STATUS_COLORS[s].label}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>

          <p className={styles.resultsCount}>
            Showing {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </>
      )}

      {/* Grade / Re-grade Modal */}
      {gradeModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>
              {gradeModal.isRegrade ? "Re-grade Project" : "Grade & Complete Project"}
            </h3>
            <p className={styles.modalSubtitle}>{gradeModal.title}</p>

            {gradeModal.isRegrade && gradeModal.flaggedReason && (
              <div className={styles.flagNote}>
                <strong>Admin flagged reason:</strong> {gradeModal.flaggedReason}
              </div>
            )}

            <div className={styles.membersSection}>
              <p className={styles.sectionLabel}>Individual Marks (0–100)</p>
              {gradeModal.members.length === 0 ? (
                <p className={styles.noMembersNote}>No team members found.</p>
              ) : (
                gradeModal.members.map((m) => (
                  <div key={m._id} className={styles.memberRow}>
                    <span className={styles.memberName}>{m.name}</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={memberGrades[m._id] ?? ""}
                      onChange={(e) => setGrade(m._id, e.target.value)}
                      className={styles.gradeInput}
                      placeholder="0–100"
                    />
                    <span className={styles.outOf}>/100</span>
                  </div>
                ))
              )}
            </div>

            {liveAvg !== null && (
              <p className={styles.avgNote}>
                Average: <strong>{liveAvg}</strong>/100
              </p>
            )}

            <label className={styles.label} style={{ marginTop: "16px" }}>
              Remarks (optional):
            </label>
            <textarea
              value={evalRemarks}
              onChange={(e) => setEvalRemarks(e.target.value)}
              className={styles.textarea}
              placeholder="Feedback for the team..."
            />

            <div className={styles.modalActions}>
              <button
                className={styles.completeBtn}
                onClick={handleSubmitGrades}
                disabled={completing || !allFilled}
              >
                {completing ? "Saving..." : gradeModal.isRegrade ? "Submit Re-grade" : "Mark as Completed"}
              </button>
              <button className={styles.cancelBtn} onClick={() => setGradeModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.emptyMsg}>Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className={styles.emptyMsg}>No FYP projects assigned to you yet.</p>
      ) : filteredProjects.length === 0 ? (
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
                <th>Team Leader</th>
                <th>Links</th>
                <th>Weekly Updates</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Grades Status</th>
                <th>Final Report</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const sc = STATUS_COLORS[project.status] || STATUS_COLORS.ACTIVE;
                const gc = project.status === "COMPLETED"
                  ? GRADES_STATUS_COLORS[project.gradesStatus] || GRADES_STATUS_COLORS.PENDING_RELEASE
                  : null;

                return (
                  <tr key={project._id}>
                    <td className={styles.titleCell}>{project.title}</td>
                    <td>{project.teamId?.subject || "N/A"}</td>
                    <td>{project.teamLeaderId?.name || "N/A"}</td>
                    <td>
                      <div className={styles.linksCell}>
                        {project.githubRepository ? (
                          <a
                            href={project.githubRepository}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.githubLink}
                          >
                            <FaGithub /> Repo
                          </a>
                        ) : (
                          <span className={styles.linkMissing}>No repo</span>
                        )}

                        {!project.deploymentLink && (
                          <span className={styles.linkMissing}>Live link not shared</span>
                        )}

                        <div className={styles.iconToolbar}>
                          {project.deploymentLink && (
                            <>
                              <button
                                type="button"
                                className={styles.iconToolbarBtn}
                                onClick={() => setPreviewUrl(project.deploymentLink)}
                                title="View Live"
                              >
                                <FaPlayCircle />
                              </button>
                              <button
                                type="button"
                                className={`${styles.iconToolbarBtn} ${styles.iconToolbarAmber}`}
                                onClick={() => setReviewProject(project)}
                                title="Mark Issues"
                              >
                                <FaMarker />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className={`${styles.iconToolbarBtn} ${styles.iconToolbarGray}`}
                            onClick={() => handleOpenHistoryModal(project)}
                            title="Review History"
                          >
                            <FaHistory />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleOpenProgressModal(project)}
                        style={{
                          display: "flex", alignItems: "center", gap: "6px",
                          background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe",
                          borderRadius: "8px", padding: "6px 12px", fontSize: "12.5px", fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        <FaCalendarWeek /> View Updates
                      </button>
                    </td>
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
                        {STATUS_LABEL[project.status] || project.status || "Active"}
                      </span>
                    </td>
                    <td>
                      {gc ? (
                        <span className={styles.badge} style={{ background: gc.bg, color: gc.color }}>
                          {gc.label}
                        </span>
                      ) : (
                        <span className={styles.na}>—</span>
                      )}
                    </td>
                    <td>
                      {project.finalReportUrl ? (
                        <a href={resolveFileUrl(project.finalReportUrl)} target="_blank" rel="noopener noreferrer" className={styles.viewLink}>
                          View PDF
                        </a>
                      ) : (
                        <span className={styles.na}>Not submitted</span>
                      )}
                    </td>
                    <td>
                      {project.status === "UNDER_REVIEW" && (
                        <button className={styles.completeBtn} onClick={() => openGradeModal(project, false)}>
                          Grade & Complete
                        </button>
                      )}
                      {project.status === "COMPLETED" && project.gradesStatus === "FLAGGED" && (
                        <button className={styles.regradeBtn} onClick={() => openGradeModal(project, true)}>
                          Re-grade
                        </button>
                      )}
                      {project.status === "COMPLETED" && project.gradesStatus === "PENDING_RELEASE" && (
                        <span className={styles.waitingLabel}>Awaiting Admin Review</span>
                      )}
                      {project.status === "COMPLETED" && project.gradesStatus === "RELEASED" && (
                        <div className={styles.gradesCell}>
                          <span className={styles.avgGradeLabel}>Avg: {project.evaluationMarks ?? "—"}/100</span>
                          {project.memberGrades?.length > 0 && (
                            <div className={styles.memberGradesList}>
                              {project.memberGrades.map((g) => (
                                <span key={String(g.userId)} className={styles.memberGradeChip}>
                                  {g.name}: {g.marks}
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => generateCompletionCertificate(project)}
                            style={{
                              display: "flex", alignItems: "center", gap: "5px", marginTop: "6px",
                              background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe",
                              borderRadius: "6px", padding: "4px 9px", fontSize: "11px", fontWeight: "700",
                              cursor: "pointer", width: "fit-content",
                            }}
                          >
                            <FaAward /> Certificate
                          </button>
                        </div>
                      )}
                      {!["UNDER_REVIEW", "COMPLETED"].includes(project.status) && (
                        <span className={styles.na}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {previewUrl && (
        <LivePreview url={previewUrl} title="Live Project Preview" onClose={() => setPreviewUrl(null)} />
      )}

      {reviewProject && (
        <LiveReviewModal
          url={reviewProject.deploymentLink}
          projectId={reviewProject._id}
          title={`Review: ${reviewProject.title}`}
          onClose={() => setReviewProject(null)}
          onSent={() => showToast(`Marked issues sent to the team for "${reviewProject.title}".`)}
        />
      )}

      {/* Weekly Progress Logs Modal */}
      {progressModalProject && (
        <div className={styles.overlay}>
          <div className={styles.modal} style={{ maxWidth: "640px" }}>
            <h3 className={styles.modalTitle}>Weekly Progress Updates</h3>
            <p className={styles.modalSubtitle}>{progressModalProject.title}</p>

            <div style={{ marginTop: "16px", maxHeight: "460px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
              {progressLogsLoading ? (
                <p style={{ color: "#9ca3af", fontSize: "13px" }}>Loading logs...</p>
              ) : progressLogs.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: "13px" }}>No weekly updates submitted yet.</p>
              ) : (
                progressLogs.map((log) => (
                  <div key={log._id} style={{ background: "#f8fafc", borderRadius: "10px", padding: "12px 14px", border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "13.5px", color: "#111827" }}>
                        Week {log.weekNumber} — {log.submittedBy?.name || "Team Leader"}
                      </strong>
                      <span style={{
                        fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px",
                        background: log.status === "REVIEWED" ? "#dcfce7" : "#fef3c7",
                        color: log.status === "REVIEWED" ? "#15803d" : "#92400e",
                      }}>
                        {log.status === "REVIEWED" ? "Reviewed" : "Pending Review"}
                      </span>
                    </div>
                    <p style={{ fontSize: "13px", color: "#374151", margin: "4px 0" }}><strong>Work done:</strong> {log.workDone}</p>
                    {log.plannedNext && (
                      <p style={{ fontSize: "13px", color: "#374151", margin: "4px 0" }}><strong>Planned next:</strong> {log.plannedNext}</p>
                    )}
                    {log.challenges && (
                      <p style={{ fontSize: "13px", color: "#374151", margin: "4px 0" }}><strong>Challenges:</strong> {log.challenges}</p>
                    )}

                    {log.status === "REVIEWED" ? (
                      <div style={{ marginTop: "8px", background: "#eff6ff", borderLeft: "3px solid #2563eb", borderRadius: "6px", padding: "8px 10px" }}>
                        <strong style={{ fontSize: "12px", color: "#1e40af" }}>Your feedback:</strong>
                        <p style={{ fontSize: "12.5px", color: "#1e3a8a", margin: "2px 0 0" }}>{log.supervisorFeedback}</p>
                      </div>
                    ) : (
                      <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                        <textarea
                          value={feedbackDrafts[log._id] || ""}
                          onChange={(e) => setFeedbackDrafts((f) => ({ ...f, [log._id]: e.target.value }))}
                          placeholder="Write feedback for this update..."
                          style={{ flex: 1, minHeight: "44px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "13px", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                        <button
                          onClick={() => handleSendFeedback(log._id)}
                          disabled={savingFeedbackId === log._id}
                          style={{
                            background: "#2563eb", color: "white", border: "none", borderRadius: "8px",
                            padding: "10px 14px", fontSize: "12.5px", fontWeight: "700", cursor: "pointer", flexShrink: 0,
                          }}
                        >
                          {savingFeedbackId === log._id ? "Sending..." : "Send"}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className={styles.modalActions} style={{ marginTop: "18px" }}>
              <button className={styles.cancelBtn} onClick={() => setProgressModalProject(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review History Modal */}
      {historyProject && (
        <div className={styles.overlay}>
          <div className={styles.modal} style={{ maxWidth: "680px" }}>
            <h3 className={styles.modalTitle}>Review History</h3>
            <p className={styles.modalSubtitle}>{historyProject.title}</p>

            <div style={{ marginTop: "16px", maxHeight: "480px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              {reviewHistoryLoading ? (
                <p style={{ color: "#9ca3af", fontSize: "13px" }}>Loading review history...</p>
              ) : reviewHistory.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: "13px" }}>
                  You haven't sent any marked-up screenshots for this project yet.
                </p>
              ) : (
                reviewHistory.map((rn) => (
                  <div key={rn._id} style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px", border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <strong style={{ fontSize: "13px", color: "#111827" }}>
                        {new Date(rn.createdAt).toLocaleDateString()} — {(rn.items || []).length} screenshot{(rn.items || []).length !== 1 ? "s" : ""}
                      </strong>
                      <span style={{
                        fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px",
                        background: rn.status === "RESOLVED" ? "#dcfce7" : "#fee2e2",
                        color: rn.status === "RESOLVED" ? "#15803d" : "#b91c1c",
                      }}>
                        {rn.status === "RESOLVED" ? `Resolved ${rn.resolvedAt ? new Date(rn.resolvedAt).toLocaleDateString() : ""}` : "Waiting on team"}
                      </span>
                    </div>

                    {rn.remarks && (
                      <p style={{ fontSize: "12.5px", color: "#374151", margin: "0 0 10px" }}>
                        <strong>Your remarks:</strong> {rn.remarks}
                      </p>
                    )}

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {(rn.items || []).map((item, i) => (
                        <img
                          key={i}
                          src={resolveFileUrl(item.screenshotUrl)}
                          alt={`Screenshot ${i + 1}`}
                          style={{ width: "90px", height: "60px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e5e7eb" }}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={styles.modalActions} style={{ marginTop: "18px" }}>
              <button className={styles.cancelBtn} onClick={() => setHistoryProject(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FYPProjects;
