import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../../Loader";
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

const DEFAULT_RUBRIC = [
  { name: "Problem Definition & Objectives", weight: 10, description: "Clarity, relevance and measurability of the research problem and objectives" },
  { name: "Literature Review",               weight: 10, description: "Quality, breadth and critical analysis of related work" },
  { name: "System Design & Architecture",    weight: 20, description: "Design decisions, system architecture and technical approach" },
  { name: "Implementation & Functionality",  weight: 30, description: "Code quality, feature completeness, robustness and correctness" },
  { name: "Testing & Validation",            weight: 15, description: "Test planning, coverage, results and QA" },
  { name: "Report & Documentation",          weight: 15, description: "Report structure, clarity, formatting and completeness" },
];

const INTERNAL_RUBRIC = [
  { name: "Commitment & Attendance",  weight: 25, description: "Regularity of supervision meetings and responsiveness" },
  { name: "Problem Understanding",    weight: 25, description: "Depth of understanding of the research problem and domain" },
  { name: "Independent Initiative",   weight: 25, description: "Self-driven progress and proactivity between meetings" },
  { name: "Communication Quality",    weight: 25, description: "Clarity of progress updates and oral presentations" },
];

const MIDTERM_RUBRIC = [
  { name: "Progress vs Plan",    weight: 30, description: "Achievement of milestones relative to the project timeline" },
  { name: "Technical Depth",     weight: 30, description: "Quality and depth of implementation completed so far" },
  { name: "Problem Solving",     weight: 20, description: "How challenges and blockers have been handled" },
  { name: "Documentation",       weight: 20, description: "Quality of interim reports, diagrams and progress notes" },
];

const PHASE_CONFIG = {
  INTERNAL: { label: "Supervisor Internal Assessment", weight: 20, rubric: null },
  MIDTERM:  { label: "Mid-term Evaluation",            weight: 20, rubric: null },
  FINAL:    { label: "Final Assessment",               weight: 60, rubric: null },
};

function getRubricForPhase(phase) {
  if (phase === "INTERNAL") return INTERNAL_RUBRIC;
  if (phase === "MIDTERM")  return MIDTERM_RUBRIC;
  return DEFAULT_RUBRIC; // FINAL
}

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
  const [rubricScores, setRubricScores] = useState({}); // { [memberId]: [score0, score1, ...] }
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

  const [phaseModal, setPhaseModal] = useState(null);   // { project } — phase overview
  const [historyModal, setHistoryModal] = useState(null); // { project } — grade history

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

  const openGradeModal = (project, phase = "FINAL", isRegrade = false) => {
    const members = buildMemberList(project);
    const rubric  = getRubricForPhase(phase);
    const initialScores = {};
    members.forEach((m) => {
      // Try to pre-fill from evaluationPhases data
      const phaseData = (project.evaluationPhases || []).find((p) => p.phase === phase);
      const existing  = phaseData?.memberGrades?.find((g) => String(g.userId) === m._id);
      if (existing?.rubricScores?.length) {
        initialScores[m._id] = rubric.map((c) => {
          const rs = existing.rubricScores.find((r) => r.criterionName === c.name);
          return rs !== undefined ? String(rs.score) : "";
        });
      } else if (!existing && isRegrade && phase === "FINAL") {
        // Legacy: pre-fill from top-level memberGrades for re-grade
        const leg = project.memberGrades?.find((g) => String(g.userId) === m._id);
        if (leg?.rubricScores?.length) {
          initialScores[m._id] = rubric.map((c) => {
            const rs = leg.rubricScores.find((r) => r.criterionName === c.name);
            return rs !== undefined ? String(rs.score) : "";
          });
        } else {
          initialScores[m._id] = rubric.map(() => "");
        }
      } else {
        initialScores[m._id] = rubric.map(() => "");
      }
    });
    setRubricScores(initialScores);
    setGradeModal({
      projectId:    project._id,
      title:        project.title,
      members,
      phase,
      isRegrade,
      flaggedReason: project.flaggedReason,
    });
    setEvalRemarks(isRegrade || phase !== "FINAL" ? (project.remarks || "") : "");
    setPhaseModal(null); // close phase overview when opening rubric
  };

  const setCriterionScore = (memberId, idx, val) => {
    setRubricScores((prev) => {
      const scores = [...(prev[memberId] || DEFAULT_RUBRIC.map(() => ""))];
      scores[idx] = val;
      return { ...prev, [memberId]: scores };
    });
  };

  const calcMemberWeightedScore = (memberId) => {
    const rubric = getRubricForPhase(gradeModal?.phase || "FINAL");
    const scores = rubricScores[memberId] || [];
    for (let i = 0; i < rubric.length; i++) {
      if (scores[i] === "" || scores[i] === undefined) return null;
      const n = Number(scores[i]);
      if (isNaN(n) || n < 0 || n > 100) return null;
    }
    return Math.round(
      rubric.reduce((sum, c, i) => sum + (Number(scores[i]) * c.weight) / 100, 0)
    );
  };

  const handleSubmitGrades = async () => {
    const { members, projectId, title, isRegrade, phase } = gradeModal;
    const rubric = getRubricForPhase(phase);

    for (const m of members) {
      const scores = rubricScores[m._id] || [];
      for (let i = 0; i < rubric.length; i++) {
        const n = Number(scores[i]);
        if (scores[i] === "" || scores[i] === undefined || isNaN(n) || n < 0 || n > 100) {
          alert(`Please enter valid marks (0–100) for "${m.name}" — ${rubric[i].name}.`);
          return;
        }
      }
    }

    const gradesArray = members.map((m) => {
      const scores = rubricScores[m._id] || [];
      const rubricArr = rubric.map((c, i) => ({
        criterionName: c.name,
        weight: c.weight,
        score: Number(scores[i]),
      }));
      const weightedMarks = Math.round(
        rubricArr.reduce((sum, rs) => sum + (rs.score * rs.weight) / 100, 0)
      );
      return { userId: m._id, name: m.name, marks: weightedMarks, rubricScores: rubricArr };
    });
    const avgMarks = Math.round(gradesArray.reduce((s, g) => s + g.marks, 0) / gradesArray.length);

    setCompleting(true);
    try {
      let endpoint, body, updatedProjectPatch;

      if (phase === "FINAL") {
        endpoint = isRegrade
          ? `${apiBase}/auth/projects/${projectId}/regrade`
          : `${apiBase}/auth/projects/${projectId}/complete`;
        body = { evaluationMarks: avgMarks, remarks: evalRemarks, memberGrades: gradesArray };
        updatedProjectPatch = {
          status: "COMPLETED",
          progress: 100,
          evaluationMarks: avgMarks,
          memberGrades: gradesArray,
          gradesStatus: "PENDING_RELEASE",
          flaggedReason: "",
          remarks: evalRemarks,
        };
      } else {
        endpoint = `${apiBase}/auth/projects/${projectId}/grade-phase`;
        body = { phase, memberGrades: gradesArray, remarks: evalRemarks };
        const phaseEntry = {
          phase,
          label:           phase === "INTERNAL" ? "Supervisor Internal Assessment" : "Mid-term Evaluation",
          weight:          20,
          status:          "SUBMITTED",
          submittedAt:     new Date(),
          evaluationMarks: avgMarks,
          memberGrades:    gradesArray,
          remarks:         evalRemarks,
        };
        updatedProjectPatch = {
          evaluationPhases: null, // will merge below
          _phaseEntry: phaseEntry,
        };
      }

      await axios.put(endpoint, body, { headers: { Authorization: `Bearer ${token}` } });

      showToast(
        phase === "FINAL"
          ? (isRegrade
            ? `Re-grading submitted for "${title}". Waiting for admin approval.`
            : `Project "${title}" graded and marked complete. Avg: ${avgMarks}/100.`)
          : `${phase === "INTERNAL" ? "Internal" : "Mid-term"} grades saved for "${title}". Avg: ${avgMarks}/100.`
      );

      setGradeModal(null);
      setProjects((prev) =>
        prev.map((p) => {
          if (p._id !== projectId) return p;
          if (phase === "FINAL") {
            return { ...p, ...updatedProjectPatch };
          } else {
            // Merge phase into evaluationPhases
            const existing = (p.evaluationPhases || []).filter((ep) => ep.phase !== phase);
            return { ...p, evaluationPhases: [...existing, updatedProjectPatch._phaseEntry] };
          }
        })
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to submit grades.");
    } finally {
      setCompleting(false);
    }
  };

  const allFilled = (gradeModal?.members?.every((m) => calcMemberWeightedScore(m._id) !== null) ?? false);

  const liveAvg =
    allFilled && gradeModal?.members?.length
      ? Math.round(
          gradeModal.members.reduce((s, m) => s + (calcMemberWeightedScore(m._id) || 0), 0) /
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
              {gradeModal.phase === "INTERNAL" ? "Grade Internal Assessment" :
               gradeModal.phase === "MIDTERM"  ? "Grade Mid-term Evaluation" :
               gradeModal.isRegrade            ? "Re-grade Final Assessment" :
                                                 "Grade Final & Complete Project"}
            </h3>
            <p className={styles.modalSubtitle}>{gradeModal.title}</p>

            {gradeModal.isRegrade && gradeModal.flaggedReason && (
              <div className={styles.flagNote}>
                <strong>Admin flagged reason:</strong> {gradeModal.flaggedReason}
              </div>
            )}

            <div className={styles.membersSection}>
              <p className={styles.sectionLabel}>
                {gradeModal.phase === "INTERNAL" ? "Internal Assessment Rubric" :
                 gradeModal.phase === "MIDTERM"  ? "Mid-term Evaluation Rubric" :
                                                   "Final Assessment Rubric"}
              </p>
              {gradeModal.members.length === 0 ? (
                <p className={styles.noMembersNote}>No team members found.</p>
              ) : (
                gradeModal.members.map((m) => {
                  const activeRubric = getRubricForPhase(gradeModal.phase);
                  const memberScore = calcMemberWeightedScore(m._id);
                  return (
                    <div key={m._id} className={styles.memberRubricBlock}>
                      <div className={styles.memberRubricHeader}>
                        <span className={styles.memberName}>{m.name}</span>
                        {memberScore !== null && (
                          <span className={styles.memberWeightedScore}>
                            {memberScore}/100
                          </span>
                        )}
                      </div>
                      <table className={styles.rubricTable}>
                        <thead>
                          <tr>
                            <th className={styles.rubricThCriterion}>Criterion</th>
                            <th className={styles.rubricThWt}>Wt.</th>
                            <th className={styles.rubricThScore}>Score</th>
                            <th className={styles.rubricThContrib}>Contrib.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeRubric.map((c, i) => {
                            const raw = rubricScores[m._id]?.[i];
                            const contrib =
                              raw !== "" && raw !== undefined && !isNaN(Number(raw))
                                ? ((Number(raw) * c.weight) / 100).toFixed(1)
                                : "—";
                            return (
                              <tr key={i} className={styles.rubricRow}>
                                <td className={styles.rubricCriterionCell}>
                                  <div className={styles.criterionName}>{c.name}</div>
                                  <div className={styles.criterionDesc}>{c.description}</div>
                                </td>
                                <td className={styles.rubricWeightCell}>{c.weight}%</td>
                                <td className={styles.rubricScoreCell}>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={raw ?? ""}
                                    onChange={(e) => setCriterionScore(m._id, i, e.target.value)}
                                    className={styles.criterionInput}
                                    placeholder="0–100"
                                  />
                                </td>
                                <td className={styles.rubricContribCell}>{contrib}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>

            {liveAvg !== null && (
              <p className={styles.avgNote}>
                Team Average: <strong>{liveAvg}</strong>/100
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
                {completing ? "Saving..." :
                 gradeModal.phase !== "FINAL" ? "Save Phase Grades" :
                 gradeModal.isRegrade         ? "Submit Re-grade" :
                                               "Mark as Completed"}
              </button>
              <button className={styles.cancelBtn} onClick={() => setGradeModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase Overview Modal */}
      {phaseModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Evaluation Phases</h3>
            <p className={styles.modalSubtitle}>{phaseModal.project.title}</p>

            {["INTERNAL", "MIDTERM", "FINAL"].map((ph) => {
              const cfg       = { INTERNAL: { label: "Supervisor Internal Assessment", weight: 20 }, MIDTERM: { label: "Mid-term Evaluation", weight: 20 }, FINAL: { label: "Final Assessment", weight: 60 } }[ph];
              const phaseData = (phaseModal.project.evaluationPhases || []).find((p) => p.phase === ph);
              const submitted = phaseData?.status === "SUBMITTED";
              const canGrade  = ph === "FINAL"
                ? phaseModal.project.status === "UNDER_REVIEW"
                : true;

              return (
                <div key={ph} className={styles.phaseCard}>
                  <div className={styles.phaseCardTop}>
                    <div>
                      <span className={styles.phaseLabel}>{cfg.label}</span>
                      <span className={styles.phaseWeight}>{cfg.weight}%</span>
                    </div>
                    <span className={submitted ? styles.phaseSubmitted : styles.phasePending}>
                      {submitted ? `${phaseData.evaluationMarks}/100` : "Pending"}
                    </span>
                  </div>
                  {submitted && phaseData.submittedAt && (
                    <p className={styles.phaseDate}>
                      Submitted: {new Date(phaseData.submittedAt).toLocaleDateString()}
                      {phaseData.remarks && ` — "${phaseData.remarks}"`}
                    </p>
                  )}
                  {canGrade && (
                    <button
                      className={styles.phaseGradeBtn}
                      onClick={() => openGradeModal(phaseModal.project, ph, ph === "FINAL" && phaseModal.project.gradesStatus === "FLAGGED")}
                    >
                      {submitted ? "Revise Marks" : "Grade Now"}
                    </button>
                  )}
                  {ph === "FINAL" && !canGrade && (
                    <p className={styles.phaseLocked}>Final grading available after student submits final report.</p>
                  )}
                </div>
              );
            })}

            {/* Combined overall */}
            {(phaseModal.project.evaluationPhases || []).some((p) => p.status === "SUBMITTED") && (
              <div className={styles.phaseOverallRow}>
                <span>Combined Average</span>
                <strong>{phaseModal.project.evaluationMarks ?? 0}/100</strong>
              </div>
            )}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setPhaseModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Grade History Modal */}
      {historyModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Grade History</h3>
            <p className={styles.modalSubtitle}>{historyModal.project.title}</p>

            {!(historyModal.project.gradeHistory?.length) ? (
              <p className={styles.noMembersNote}>No grade history recorded yet.</p>
            ) : (
              <div className={styles.historyList}>
                {[...(historyModal.project.gradeHistory || [])].reverse().map((h, i) => (
                  <div key={i} className={styles.historyEntry}>
                    <div className={styles.historyEntryTop}>
                      <span className={styles.historyPhase}>
                        {h.phase === "INTERNAL" ? "Internal Assessment" : h.phase === "MIDTERM" ? "Mid-term Evaluation" : "Final Assessment"}
                      </span>
                      <span className={h.action === "REVISED" ? styles.historyRevised : styles.historySubmitted}>
                        {h.action}
                      </span>
                    </div>
                    <p className={styles.historyMeta}>
                      {new Date(h.timestamp).toLocaleString()} — Avg: <strong>{h.evaluationMarks}/100</strong>
                    </p>
                    {h.memberGrades?.length > 0 && (
                      <div className={styles.historyMembers}>
                        {h.memberGrades.map((g, j) => (
                          <span key={j} className={styles.historyMemberChip}>{g.name}: {g.marks}</span>
                        ))}
                      </div>
                    )}
                    {h.remarks && <p className={styles.historyRemarks}>Remarks: {h.remarks}</p>}
                    {h.revisionReason && <p className={styles.historyRevisionReason}>Reason: {h.revisionReason}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setHistoryModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <Loader text="Loading projects..." />
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
                      <div className={styles.actionsCell}>
                        {/* Phase grading overview — always available */}
                        <button className={styles.phasesBtn} onClick={() => setPhaseModal({ project })}>
                          Phases
                        </button>

                        {/* History — only when gradeHistory exists */}
                        {(project.gradeHistory?.length > 0 || project.evaluationPhases?.some(p => p.status === "SUBMITTED")) && (
                          <button className={styles.historyBtn} onClick={() => setHistoryModal({ project })}>
                            History
                          </button>
                        )}

                        {project.status === "UNDER_REVIEW" && (
                          <button className={styles.completeBtn} onClick={() => openGradeModal(project, "FINAL", false)}>
                            Grade Final
                          </button>
                        )}
                        {project.status === "COMPLETED" && project.gradesStatus === "FLAGGED" && (
                          <button className={styles.regradeBtn} onClick={() => openGradeModal(project, "FINAL", true)}>
                            Re-grade
                          </button>
                        )}
                        {project.status === "COMPLETED" && project.gradesStatus === "PENDING_RELEASE" && (
                          <span className={styles.awaitingLabel}>Awaiting Review</span>
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
                            <button className={styles.certBtn} onClick={() => generateCompletionCertificate(project)}>
                              Certificate
                            </button>
                          </div>
                        )}
                        {/* Viva info on supervisor side */}
                        {project.vivaDetails?.status === "SCHEDULED" && (
                          <div className={styles.vivaInfoChip}>
                            Viva: {new Date(project.vivaDetails.scheduledAt).toLocaleDateString()}
                            {project.vivaDetails.venue ? ` @ ${project.vivaDetails.venue}` : ""}
                          </div>
                        )}
                        {project.vivaDetails?.status === "GRADED" && (
                          <div className={styles.vivaGradedChip}>
                            Viva done · Combined: {project.overallFinalMarks ?? project.evaluationMarks}/100
                          </div>
                        )}
                      </div>
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
