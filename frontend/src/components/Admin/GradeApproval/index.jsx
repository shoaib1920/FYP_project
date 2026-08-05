import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../../Loader";
import { resolveFileUrl } from "../../../utils/resolveFileUrl";
import { showToast } from "../../../utils/toastStore";
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
  FaMapMarkerAlt,
  FaVideo,
  FaUserTie,
  FaPlus,
  FaBalanceScale,
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

const VIVA_RUBRIC = [
  { name: "Presentation Quality",  weight: 25, description: "Clarity, structure and delivery of the presentation" },
  { name: "Technical Knowledge",   weight: 30, description: "Depth of understanding demonstrated during Q&A" },
  { name: "Project Demonstration", weight: 25, description: "Live demo quality, feature coverage and issue handling" },
  { name: "Problem Solving Q&A",   weight: 20, description: "Ability to answer unexpected questions and think critically" },
];

const GradeApproval = () => {
  const [projects, setProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]); // every project, any status — denominator for department completion
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("PENDING_RELEASE");
  const [flagModal, setFlagModal] = useState(null); // { projectId, title }
  const [flagReason, setFlagReason] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [vivaScheduleModal, setVivaScheduleModal] = useState(null); // { project }
  const [vivaGradeModal, setVivaGradeModal]       = useState(null); // { project }
  const [vivaForm, setVivaForm] = useState({
    scheduledAt: "", mode: "IN_PERSON", venue: "", meetingLink: "",
    durationMinutes: 30, instructions: "", examiners: [{ name: "", role: "" }],
  });
  const [vivaRubricScores, setVivaRubricScores]   = useState({}); // { [memberId]: [s0,s1,s2,s3] }
  const [vivaRemarks, setVivaRemarks]             = useState("");
  const [vivaLoading, setVivaLoading]             = useState(false);
  const [appealModal, setAppealModal] = useState(null); // { project }
  const [appealResponse, setAppealResponse] = useState("");
  const [resolvingAppeal, setResolvingAppeal] = useState(false);

  const token = localStorage.getItem("adminToken");
  const apiBase = process.env.REACT_APP_API_URL || "";

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
      showToast(`No released grades yet for ${deptName} — nothing to report.`, "info");
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
      showToast(err.response?.data?.message || "Failed to release grades.", "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleArchiveCode = async (project) => {
    setActionLoading(project._id + "_archive");
    try {
      const res = await axios.post(
        `${apiBase}/auth/projects/${project._id}/archive-code`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects((prev) =>
        prev.map((p) => p._id === project._id ? { ...p, codeArchive: res.data.codeArchive } : p)
      );
      if (res.data.success) {
        showToast(`Source code archived for "${project.title}" — full commit history preserved.`, "success");
      } else {
        showToast(res.data.message || "Couldn't clone the repository automatically.", "warning");
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to archive source code.", "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleFlagSubmit = async () => {
    if (!flagReason.trim()) {
      showToast("Please provide a reason for flagging.", "warning");
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
      showToast(err.response?.data?.message || "Failed to flag project.", "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleResolveAppeal = async (action) => {
    setResolvingAppeal(true);
    try {
      const res = await axios.put(
        `${apiBase}/auth/admin/projects/${appealModal.project._id}/resolve-appeal`,
        { action, adminResponse: appealResponse.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects((prev) => prev.map((p) => (p._id === appealModal.project._id ? { ...p, ...res.data.project } : p)));
      showToast(
        action === "ACCEPT"
          ? `Appeal accepted — "${appealModal.project.title}" reopened for re-grading.`
          : `Appeal rejected — grade for "${appealModal.project.title}" stands.`
      );
      setAppealModal(null);
      setAppealResponse("");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to resolve appeal.", "error");
    } finally {
      setResolvingAppeal(false);
    }
  };

  const openVivaScheduleModal = (project) => {
    const existing = project.vivaDetails;
    setVivaForm({
      scheduledAt:  existing?.scheduledAt ? new Date(existing.scheduledAt).toISOString().slice(0, 16) : "",
      mode:            existing?.mode || "IN_PERSON",
      venue:           existing?.venue || "",
      meetingLink:     existing?.meetingLink || "",
      durationMinutes: existing?.durationMinutes || 30,
      instructions:    existing?.instructions || "",
      examiners:       existing?.examiners?.length ? existing.examiners : [{ name: "", role: "" }],
    });
    setVivaScheduleModal({ project });
  };

  const setVivaExaminer = (idx, field, value) => {
    setVivaForm((f) => ({
      ...f,
      examiners: f.examiners.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex)),
    }));
  };

  const addVivaExaminer = () => {
    setVivaForm((f) => ({ ...f, examiners: [...f.examiners, { name: "", role: "" }] }));
  };

  const removeVivaExaminer = (idx) => {
    setVivaForm((f) => ({ ...f, examiners: f.examiners.filter((_, i) => i !== idx) }));
  };

  const handleScheduleViva = async () => {
    if (!vivaForm.scheduledAt) { showToast("Please select a date and time.", "warning"); return; }
    setVivaLoading(true);
    try {
      const res = await axios.put(
        `${apiBase}/auth/admin/projects/${vivaScheduleModal.project._id}/schedule-viva`,
        vivaForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects((prev) => prev.map((p) => p._id === vivaScheduleModal.project._id ? { ...p, vivaDetails: res.data.project.vivaDetails } : p));
      showToast(`Viva scheduled for "${vivaScheduleModal.project.title}". Team has been notified.`);
      setVivaScheduleModal(null);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to schedule viva.", "error");
    } finally {
      setVivaLoading(false);
    }
  };

  const openVivaGradeModal = (project) => {
    const members = project.memberGrades?.length
      ? project.memberGrades
      : [{ userId: project.teamLeaderId?._id, name: project.teamLeaderId?.name || "Unknown" }];
    const initial = {};
    members.forEach((m) => {
      const existing = project.vivaDetails?.memberVivaGrades?.find((v) => String(v.userId) === String(m.userId));
      initial[String(m.userId)] = existing?.rubricScores?.length
        ? existing.rubricScores.map((rs) => String(rs.score))
        : VIVA_RUBRIC.map(() => "");
    });
    setVivaRubricScores(initial);
    setVivaRemarks(project.vivaDetails?.remarks || "");
    setVivaGradeModal({ project, members });
  };

  const setVivaCriterionScore = (memberId, idx, val) => {
    setVivaRubricScores((prev) => ({
      ...prev,
      [memberId]: prev[memberId].map((v, i) => (i === idx ? val : v)),
    }));
  };

  const calcVivaWeightedScore = (memberId) => {
    const scores = vivaRubricScores[memberId] || [];
    for (let i = 0; i < VIVA_RUBRIC.length; i++) {
      if (scores[i] === "" || scores[i] === undefined) return null;
      const n = Number(scores[i]);
      if (isNaN(n) || n < 0 || n > 100) return null;
    }
    return Math.round(VIVA_RUBRIC.reduce((sum, c, i) => sum + (Number(scores[i]) * c.weight) / 100, 0));
  };

  const handleSubmitVivaGrades = async () => {
    const { project, members } = vivaGradeModal;
    for (const m of members) {
      const s = calcVivaWeightedScore(String(m.userId));
      if (s === null) { showToast(`Please fill in all scores for ${m.name}.`, "warning"); return; }
    }
    const gradesArray = members.map((m) => {
      const scores = vivaRubricScores[String(m.userId)] || [];
      const rubricArr = VIVA_RUBRIC.map((c, i) => ({ criterionName: c.name, weight: c.weight, score: Number(scores[i]) }));
      const marks = Math.round(rubricArr.reduce((s, rs) => s + (rs.score * rs.weight) / 100, 0));
      return { userId: m.userId, name: m.name, marks, rubricScores: rubricArr };
    });
    setVivaLoading(true);
    try {
      const res = await axios.put(
        `${apiBase}/auth/admin/projects/${project._id}/grade-viva`,
        { memberVivaGrades: gradesArray, remarks: vivaRemarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updated = res.data.project;
      setProjects((prev) => prev.map((p) => p._id === project._id ? { ...p, ...updated } : p));
      const avg = updated.overallFinalMarks ?? updated.evaluationMarks;
      showToast(`Viva grades recorded for "${project.title}". Combined avg: ${avg}/100.`);
      setVivaGradeModal(null);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save viva grades.", "error");
    } finally {
      setVivaLoading(false);
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

      {/* Resolve Grade Appeal Modal */}
      {appealModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}><FaBalanceScale style={{ marginRight: "8px" }} />Grade Appeal</h3>
            <p className={styles.modalSubtitle}>{appealModal.project.title}</p>

            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px" }}>
              <p style={{ fontSize: "12.5px", color: "#92400e", margin: 0 }}>
                <strong>{appealModal.project.gradeAppeal.requestedByName}</strong> requested this review:
              </p>
              <p style={{ fontSize: "13px", color: "#78350f", margin: "6px 0 0" }}>
                "{appealModal.project.gradeAppeal.reason}"
              </p>
            </div>

            <label className={styles.label}>Your response (optional, sent to the student)</label>
            <textarea
              className={styles.textarea}
              rows={3}
              value={appealResponse}
              onChange={(e) => setAppealResponse(e.target.value)}
              placeholder="Explain your decision..."
            />

            <div className={styles.modalActions}>
              <button
                className={styles.releaseBtn}
                onClick={() => handleResolveAppeal("ACCEPT")}
                disabled={resolvingAppeal}
              >
                {resolvingAppeal ? "Saving..." : "Accept — Reopen for Re-grading"}
              </button>
              <button
                className={styles.flagBtn}
                onClick={() => handleResolveAppeal("REJECT")}
                disabled={resolvingAppeal}
              >
                {resolvingAppeal ? "Saving..." : "Reject — Grade Stands"}
              </button>
              <button className={styles.cancelBtn} onClick={() => { setAppealModal(null); setAppealResponse(""); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viva Schedule Modal */}
      {vivaScheduleModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Schedule Viva Defense</h3>
            <p className={styles.modalSubtitle}>{vivaScheduleModal.project.title}</p>

            <label className={styles.label}>Date &amp; Time *</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={vivaForm.scheduledAt}
              onChange={(e) => setVivaForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            />

            <label className={styles.label}>Duration (minutes)</label>
            <input
              type="number"
              min="10"
              step="5"
              className={styles.input}
              value={vivaForm.durationMinutes}
              onChange={(e) => setVivaForm((f) => ({ ...f, durationMinutes: e.target.value }))}
            />

            <label className={styles.label}>Mode</label>
            <div className={styles.modeToggle}>
              <button
                type="button"
                className={`${styles.modeBtn} ${vivaForm.mode === "IN_PERSON" ? styles.modeBtnActive : ""}`}
                onClick={() => setVivaForm((f) => ({ ...f, mode: "IN_PERSON" }))}
              >
                <FaMapMarkerAlt /> In Person
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${vivaForm.mode === "ONLINE" ? styles.modeBtnActive : ""}`}
                onClick={() => setVivaForm((f) => ({ ...f, mode: "ONLINE" }))}
              >
                <FaVideo /> Online
              </button>
            </div>

            {vivaForm.mode === "IN_PERSON" ? (
              <>
                <label className={styles.label}>Venue / Room</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Seminar Hall A, Lab 201"
                  value={vivaForm.venue}
                  onChange={(e) => setVivaForm((f) => ({ ...f, venue: e.target.value }))}
                />
              </>
            ) : (
              <>
                <label className={styles.label}>Meeting Link</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. https://meet.google.com/xyz"
                  value={vivaForm.meetingLink}
                  onChange={(e) => setVivaForm((f) => ({ ...f, meetingLink: e.target.value }))}
                />
              </>
            )}

            <label className={styles.label}><FaUserTie /> Examination Panel</label>
            {vivaForm.examiners.map((ex, idx) => (
              <div key={idx} className={styles.examinerRow}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Name"
                  value={ex.name}
                  onChange={(e) => setVivaExaminer(idx, "name", e.target.value)}
                />
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Role (e.g. External Examiner)"
                  value={ex.role}
                  onChange={(e) => setVivaExaminer(idx, "role", e.target.value)}
                />
                {vivaForm.examiners.length > 1 && (
                  <button type="button" className={styles.removeExaminerBtn} onClick={() => removeVivaExaminer(idx)}>
                    <FaTimes />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className={styles.addExaminerBtn} onClick={addVivaExaminer}>
              <FaPlus /> Add Examiner
            </button>

            <label className={styles.label}>Instructions for Students (optional)</label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="e.g. Bring a printed copy of your final report and be ready to demo your project."
              value={vivaForm.instructions}
              onChange={(e) => setVivaForm((f) => ({ ...f, instructions: e.target.value }))}
            />

            <div className={styles.modalActions}>
              <button className={styles.releaseBtn} onClick={handleScheduleViva} disabled={vivaLoading}>
                {vivaLoading ? "Scheduling..." : "Confirm Schedule"}
              </button>
              <button className={styles.cancelBtn} onClick={() => setVivaScheduleModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Viva Grade Modal */}
      {vivaGradeModal && (
        <div className={styles.overlay}>
          <div className={`${styles.modal} ${styles.vivaGradeModal}`}>
            <h3 className={styles.modalTitle}>Enter Viva Marks</h3>
            <p className={styles.modalSubtitle}>{vivaGradeModal.project.title}</p>
            <p className={styles.vivaCombineNote}>
              Combined final = Supervisor 60% + Viva 40%
            </p>

            {vivaGradeModal.members.map((m) => {
              const memberIdStr = String(m.userId);
              const weighted = calcVivaWeightedScore(memberIdStr);
              return (
                <div key={memberIdStr} className={styles.memberRubricBlock}>
                  <div className={styles.memberRubricHeader}>
                    <span>{m.name}</span>
                    {weighted !== null && (
                      <span className={styles.memberWeightedScore}>Viva: {weighted}/100</span>
                    )}
                  </div>
                  <table className={styles.rubricTable}>
                    <thead>
                      <tr>
                        <th className={styles.rubricCriterionCell}>Criterion</th>
                        <th className={styles.rubricWeightCell}>Wt%</th>
                        <th className={styles.rubricScoreCell}>Score /100</th>
                        <th className={styles.rubricContribCell}>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {VIVA_RUBRIC.map((c, idx) => {
                        const val   = (vivaRubricScores[memberIdStr] || [])[idx] ?? "";
                        const num   = Number(val);
                        const contrib = val !== "" && !isNaN(num) ? ((num * c.weight) / 100).toFixed(1) : "—";
                        return (
                          <tr key={idx} className={styles.rubricRow}>
                            <td className={styles.rubricCriterionCell}>
                              <span className={styles.criterionName}>{c.name}</span>
                              <span className={styles.criterionDesc}>{c.description}</span>
                            </td>
                            <td className={styles.rubricWeightCell}>{c.weight}%</td>
                            <td className={styles.rubricScoreCell}>
                              <input
                                type="number"
                                min={0} max={100}
                                className={styles.criterionInput}
                                value={val}
                                onChange={(e) => setVivaCriterionScore(memberIdStr, idx, e.target.value)}
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
            })}

            <label className={styles.label}>Viva Remarks</label>
            <textarea
              className={styles.textarea}
              rows={2}
              value={vivaRemarks}
              onChange={(e) => setVivaRemarks(e.target.value)}
              placeholder="Optional notes from the panel..."
            />

            <div className={styles.modalActions}>
              <button className={styles.releaseBtn} onClick={handleSubmitVivaGrades} disabled={vivaLoading}>
                {vivaLoading ? "Saving..." : "Save Viva Marks"}
              </button>
              <button className={styles.cancelBtn} onClick={() => setVivaGradeModal(null)}>Cancel</button>
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
              onScheduleViva={openVivaScheduleModal}
              onGradeViva={openVivaGradeModal}
              onOpenAppeal={(p) => setAppealModal({ project: p })}
              onArchiveCode={handleArchiveCode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectCard = ({ project, activeTab, actionLoading, onRelease, onFlag, apiBase, onScheduleViva, onGradeViva, onOpenAppeal, onArchiveCode }) => {
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

      {/* Phase breakdown if available */}
      {expanded && project.evaluationPhases?.filter(p => p.status === "SUBMITTED").length > 0 && (
        <div className={styles.phaseSummary}>
          <p className={styles.phaseSummaryTitle}>Phase Breakdown</p>
          {project.evaluationPhases.filter(p => p.status === "SUBMITTED").map((ph, i) => (
            <div key={i} className={styles.phaseSummaryRow}>
              <span className={styles.phaseSummaryLabel}>{ph.label || ph.phase} ({ph.weight}%)</span>
              <span className={styles.phaseSummaryMark}>{ph.evaluationMarks}/100</span>
              <span className={styles.phaseSummaryContrib}>= {((ph.evaluationMarks * ph.weight) / 100).toFixed(1)} pts</span>
            </div>
          ))}
        </div>
      )}

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

      {/* Source code archive */}
      <div className={styles.archiveBox}>
        <div className={styles.archiveHeader}>
          <span className={styles.archiveLabel}>Source Code Archive</span>
          {project.codeArchive?.status !== "ARCHIVED" && (
            <button
              type="button"
              className={styles.archiveBtn}
              disabled={actionLoading === project._id + "_archive"}
              onClick={() => onArchiveCode(project)}
            >
              {actionLoading === project._id + "_archive"
                ? "Archiving..."
                : project.codeArchive?.status === "FAILED" ? "Retry Archive" : "Archive Source Code"}
            </button>
          )}
        </div>

        {project.codeArchive?.status === "ARCHIVED" ? (
          <div className={styles.archiveArchived}>
            {project.codeArchive.method === "GIT_CLONE" ? (
              <span>
                <FaCheckCircle className={styles.archiveOkIcon} /> Full history archived —{" "}
                <strong>{project.codeArchive.commitCount}</strong> commit{project.codeArchive.commitCount === 1 ? "" : "s"} preserved
              </span>
            ) : (
              <span>
                <FaCheckCircle className={styles.archiveOkIcon} /> Archived from a team-uploaded ZIP (snapshot only, no history)
              </span>
            )}
            <span className={styles.archiveMeta}>
              {new Date(project.codeArchive.archivedAt).toLocaleDateString()}
              {project.codeArchive.checksum && ` · ${project.codeArchive.checksum.slice(0, 10)}`}
            </span>
          </div>
        ) : project.codeArchive?.status === "FAILED" ? (
          <p className={styles.archiveFailed}>
            {project.codeArchive.failureReason || "Could not clone the repository."} The team has been prompted to upload a ZIP instead.
          </p>
        ) : (
          <p className={styles.archiveNote}>Not archived yet — preserves the team's code independently of their GitHub account.</p>
        )}
      </div>

      {/* Viva Defense Section */}
      <div className={styles.vivaSection}>
        {!project.vivaDetails?.status && activeTab === "RELEASED" && (
          <button className={styles.vivaScheduleBtn} onClick={() => onScheduleViva(project)}>
            Schedule Viva Defense
          </button>
        )}
        {project.vivaDetails?.status === "SCHEDULED" && (
          <div className={styles.vivaScheduledBox}>
            <div className={styles.vivaScheduledHeader}>
              <span className={styles.vivaScheduledLabel}>Viva Scheduled</span>
              <span className={styles.vivaScheduledDate}>
                {new Date(project.vivaDetails.scheduledAt).toLocaleString()}
              </span>
            </div>
            {project.vivaDetails.venue && <p className={styles.vivaMeta}>Venue: {project.vivaDetails.venue}</p>}
            {project.vivaDetails.examinerName && <p className={styles.vivaMeta}>Examiner: {project.vivaDetails.examinerName}</p>}
            <div className={styles.vivaActions}>
              <button className={styles.vivaGradeBtn} onClick={() => onGradeViva(project)}>
                Enter Viva Marks
              </button>
              <button className={styles.vivaRescheduleBtn} onClick={() => onScheduleViva(project)}>
                Reschedule
              </button>
            </div>
          </div>
        )}
        {project.vivaDetails?.status === "GRADED" && (
          <div className={styles.vivaGradedBox}>
            <div className={styles.vivaGradedHeader}>
              <span className={styles.vivaGradedLabel}>Viva Graded</span>
              <span className={styles.vivaGradedAvg}>Viva Avg: {project.vivaDetails.vivaMarks}/100</span>
            </div>
            <div className={styles.vivaCombinedRow}>
              <span>Supervisor: <strong>{project.evaluationPhases?.find(p => p.phase === "FINAL")?.evaluationMarks ?? "—"}/100</strong> × 60%</span>
              <span>Viva: <strong>{project.vivaDetails.vivaMarks}/100</strong> × 40%</span>
              <span className={styles.vivaCombinedFinal}>Combined: <strong>{project.overallFinalMarks ?? project.evaluationMarks}/100</strong></span>
            </div>
            {project.vivaDetails.memberVivaGrades?.length > 0 && (
              <div className={styles.vivaMemberList}>
                {project.vivaDetails.memberVivaGrades.map((v, i) => (
                  <span key={i} className={styles.vivaMemberChip}>{v.name}: {v.marks}</span>
                ))}
              </div>
            )}
            <button className={styles.vivaRescheduleBtn} onClick={() => onGradeViva(project)}>
              Revise Viva Marks
            </button>
          </div>
        )}
      </div>

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

      {activeTab === "RELEASED" && project.gradeAppeal?.status === "REQUESTED" && (
        <div className={styles.appealBox}>
          <div className={styles.appealHeader}>
            <FaBalanceScale /> Grade Appeal Requested
          </div>
          <p className={styles.appealReason}>
            {project.gradeAppeal.requestedByName}: "{project.gradeAppeal.reason}"
          </p>
          <button className={styles.appealReviewBtn} onClick={() => onOpenAppeal(project)}>
            Review Appeal
          </button>
        </div>
      )}

      {activeTab === "RELEASED" && project.gradeAppeal?.status !== "REQUESTED" && (
        <div className={styles.releasedBadge}>
          Grades Released
          {project.gradeAppeal?.status === "REJECTED" && (
            <span className={styles.appealHistoryNote}> · Prior appeal rejected</span>
          )}
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
