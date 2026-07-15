const Project = require("../Models/Project");
const Notification = require("../Models/Notification");
const AssignedProject = require("../Models/SupervisorModels/AssignedProject");
const Users = require("../Models/Users");
const AcademicTerm = require("../Models/AcademicTerm");
const sendEmail = require("../utils/emailService");
const { logAction } = require("./AuditLogController");

const createNotification = async ({ userId, title, message, relatedType, relatedId }) => {
  try {
    await Notification.create({ userId, title, message, relatedType, relatedId });
  } catch (err) {
    console.error("Notification creation failed:", err);
  }
};

// Notify every graded team member (falls back to the team leader if no per-member grades exist yet)
const notifyTeamMembers = async (project, { title, message, relatedType, relatedId }) => {
  const recipientIds = new Set();
  (project.memberGrades || []).forEach((mg) => {
    if (mg.userId) recipientIds.add(String(mg.userId));
  });
  if (recipientIds.size === 0 && project.teamLeaderId) {
    recipientIds.add(String(project.teamLeaderId));
  }

  await Promise.all(
    [...recipientIds].map((userId) =>
      createNotification({ userId, title, message, relatedType, relatedId })
    )
  );
};

// Email every graded team member (falls back to the team leader if no per-member grades exist yet)
const emailTeamMembers = async (project, { subject, bodyHtml }) => {
  const recipientIds = new Set();
  (project.memberGrades || []).forEach((mg) => {
    if (mg.userId) recipientIds.add(String(mg.userId));
  });
  if (recipientIds.size === 0 && project.teamLeaderId) {
    recipientIds.add(String(project.teamLeaderId));
  }
  if (recipientIds.size === 0) return;

  try {
    const recipients = await Users.find({ _id: { $in: [...recipientIds] } }).select("email name");
    await Promise.all(
      recipients
        .filter((u) => u.email)
        .map((u) => sendEmail(u.email, subject, `<p>Hi ${u.name || "there"},</p>${bodyHtml}`))
    );
  } catch (err) {
    console.error("Failed to email team members:", err);
  }
};

const PHASE_CONFIG = {
  INTERNAL: { label: "Supervisor Internal Assessment", weight: 20 },
  MIDTERM:  { label: "Mid-term Evaluation",            weight: 20 },
  FINAL:    { label: "Final Assessment",               weight: 60 },
};

// Recalculate project-level evaluationMarks from submitted phases.
// Falls back to direct evaluationMarks if no phases exist yet.
function calcOverallFromPhases(project) {
  const submitted = (project.evaluationPhases || []).filter((p) => p.status === "SUBMITTED");
  if (!submitted.length) return project.evaluationMarks || 0;
  const totalWeight = submitted.reduce((s, p) => s + (p.weight || 0), 0);
  const weightedSum  = submitted.reduce((s, p) => s + (p.evaluationMarks || 0) * (p.weight || 0), 0);
  return Math.round(weightedSum / Math.max(totalWeight, 1));
}

function calcOverallFinal(supervisorMarks, vivaMarks) {
  return Math.round(supervisorMarks * 0.6 + vivaMarks * 0.4);
}

// Build per-member weighted marks from all submitted phases.
function calcCombinedMemberGrades(project) {
  const submitted = (project.evaluationPhases || []).filter((p) => p.status === "SUBMITTED");
  if (!submitted.length) return project.memberGrades || [];
  const totalWeight = submitted.reduce((s, p) => s + (p.weight || 0), 0);
  const userMap = new Map();
  submitted.forEach((phase) => {
    (phase.memberGrades || []).forEach((mg) => {
      const uid = String(mg.userId);
      if (!userMap.has(uid)) userMap.set(uid, { userId: mg.userId, name: mg.name, sum: 0 });
      userMap.get(uid).sum += (mg.marks || 0) * (phase.weight || 0);
    });
  });
  return Array.from(userMap.values()).map((u) => ({
    userId: u.userId,
    name:   u.name,
    marks:  Math.round(u.sum / Math.max(totalWeight, 1)),
  }));
}

// GET /projects/:projectId
exports.getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId)
      .populate("teamId", "subject members createdBy")
      .populate("teamLeaderId", "name email")
      .populate("supervisorId", "name email designation")
      .populate("departmentId", "name")
      .lean();

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json({ success: true, project });
  } catch (err) {
    console.error("Error fetching project:", err);
    res.status(500).json({ message: "Server error while fetching project" });
  }
};

// GET /projects/team/:teamId
exports.getProjectsByTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const projects = await Project.find({ teamId })
      .populate("supervisorId", "name email")
      .populate("teamLeaderId", "name email")
      .lean();

    res.json({ success: true, projects });
  } catch (err) {
    console.error("Error fetching team projects:", err);
    res.status(500).json({ message: "Server error while fetching team projects" });
  }
};

// PUT /projects/:projectId/details  (Student/Team Leader)
// Updates: githubRepository, deploymentLink
// Auto-transitions ACTIVE → IN_PROGRESS
exports.updateProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;
    const { githubRepository, deploymentLink } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (String(project.teamLeaderId) !== String(userId)) {
      return res.status(403).json({ message: "Only the team leader can update project details" });
    }

    if (["COMPLETED", "CANCELLED"].includes(project.status)) {
      return res.status(400).json({ message: "Cannot update a completed or cancelled project" });
    }

    if (githubRepository !== undefined) project.githubRepository = githubRepository;
    if (deploymentLink !== undefined) project.deploymentLink = deploymentLink;

    // Auto-transition: first meaningful update moves project to IN_PROGRESS
    if (project.status === "ACTIVE" && (githubRepository || deploymentLink)) {
      project.status = "IN_PROGRESS";
    }

    await project.save();

    await createNotification({
      userId: project.supervisorId,
      title: "Project Details Updated",
      message: `Team leader updated project details for "${project.title}".`,
      relatedType: "project",
      relatedId: project._id,
    });

    res.json({ success: true, project });
  } catch (err) {
    console.error("Error updating project details:", err);
    res.status(500).json({ message: "Server error while updating project details" });
  }
};

// PUT /projects/:projectId/progress  (Supervisor)
// Updates: progress, remarks, status (IN_PROGRESS / ON_HOLD)
exports.updateProjectProgress = async (req, res) => {
  try {
    const { projectId } = req.params;
    const supervisorId = req.user._id;
    const { progress, remarks, status } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (String(project.supervisorId) !== String(supervisorId)) {
      return res.status(403).json({ message: "Only the assigned supervisor can update progress" });
    }

    if (["COMPLETED", "CANCELLED"].includes(project.status)) {
      return res.status(400).json({ message: "Cannot update a completed or cancelled project" });
    }

    const allowedStatuses = ["IN_PROGRESS", "ON_HOLD", "ACTIVE"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowedStatuses.join(", ")}` });
    }

    if (progress !== undefined) {
      if (progress < 0 || progress > 100) {
        return res.status(400).json({ message: "Progress must be between 0 and 100" });
      }
      project.progress = progress;
    }

    if (remarks !== undefined) project.remarks = remarks;
    if (status) project.status = status;

    await project.save();

    await createNotification({
      userId: project.teamLeaderId,
      title: "Project Progress Updated",
      message: `Your supervisor updated progress for "${project.title}" to ${project.progress}%.`,
      relatedType: "project",
      relatedId: project._id,
    });

    res.json({ success: true, project });
  } catch (err) {
    console.error("Error updating project progress:", err);
    res.status(500).json({ message: "Server error while updating project progress" });
  }
};

// PUT /projects/:projectId/final-report  (Student/Team Leader — file upload)
// Sets finalReportUrl, transitions status → UNDER_REVIEW
exports.submitFinalReport = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (String(project.teamLeaderId) !== String(userId)) {
      return res.status(403).json({ message: "Only the team leader can submit the final report" });
    }

    if (!["IN_PROGRESS", "ACTIVE"].includes(project.status)) {
      return res.status(400).json({
        message: "Final report can only be submitted when project is ACTIVE or IN_PROGRESS",
      });
    }

    if (!project.githubRepository || !project.githubRepository.trim()) {
      return res.status(400).json({
        message: "A GitHub repository link is required before submitting the final report. Please add it in Project Links first.",
      });
    }

    const activeTerm = await AcademicTerm.findOne({ isActive: true });
    if (activeTerm && new Date() > new Date(activeTerm.finalSubmissionDeadline)) {
      return res.status(400).json({
        message: `The final submission deadline for "${activeTerm.name}" (${new Date(activeTerm.finalSubmissionDeadline).toLocaleDateString()}) has passed. Contact your admin if you need an extension.`,
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No report file uploaded" });
    }

    project.finalReportUrl = req.file.path.replace(/\\/g, "/");
    project.status = "UNDER_REVIEW";

    await project.save();

    await createNotification({
      userId: project.supervisorId,
      title: "Final Report Submitted",
      message: `Team has submitted the final report for "${project.title}". Please review.`,
      relatedType: "project",
      relatedId: project._id,
    });

    res.json({ success: true, project });
  } catch (err) {
    console.error("Error submitting final report:", err);
    res.status(500).json({ message: "Server error while submitting final report" });
  }
};

// GET /projects/supervisor  (Supervisor — all their assigned FYP projects)
exports.getProjectsBySupervisor = async (req, res) => {
  try {
    const supervisorId = req.user._id;
    const projects = await Project.find({ supervisorId })
      .populate({
        path: "teamId",
        select: "subject members createdBy memberNames",
        populate: [
          { path: "members", select: "name email", model: "users" },
          { path: "createdBy", select: "name email", model: "users" },
        ],
      })
      .populate("teamLeaderId", "name email")
      .populate("departmentId", "name")
      .lean();
    res.json({ success: true, projects });
  } catch (err) {
    console.error("Error fetching supervisor projects:", err);
    res.status(500).json({ message: "Server error while fetching supervisor projects" });
  }
};

// PUT /projects/:projectId/complete  (Supervisor)
// Sets evaluationMarks, completionDate, remarks, status → COMPLETED
exports.completeProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const supervisorId = req.user._id;
    const { evaluationMarks, remarks, memberGrades } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (String(project.supervisorId) !== String(supervisorId)) {
      return res.status(403).json({ message: "Only the assigned supervisor can complete this project" });
    }

    if (project.status === "COMPLETED") {
      return res.status(400).json({ message: "Project is already completed" });
    }

    if (evaluationMarks !== undefined) {
      if (evaluationMarks < 0 || evaluationMarks > 100) {
        return res.status(400).json({ message: "Evaluation marks must be between 0 and 100" });
      }
      project.evaluationMarks = evaluationMarks;
    }

    if (remarks !== undefined) project.remarks = remarks;
    if (memberGrades && Array.isArray(memberGrades) && memberGrades.length > 0) {
      project.memberGrades = memberGrades;
    }
    project.status = "COMPLETED";
    project.gradesStatus = "PENDING_RELEASE";
    project.completionDate = new Date();
    project.progress = 100;

    // Record FINAL phase
    const finalPhaseDoc = {
      phase:           "FINAL",
      label:           PHASE_CONFIG.FINAL.label,
      weight:          PHASE_CONFIG.FINAL.weight,
      status:          "SUBMITTED",
      submittedAt:     new Date(),
      evaluationMarks: project.evaluationMarks,
      memberGrades:    project.memberGrades,
      remarks:         project.remarks,
    };
    const finalIdx = (project.evaluationPhases || []).findIndex((p) => p.phase === "FINAL");
    if (finalIdx >= 0) {
      project.evaluationPhases[finalIdx] = finalPhaseDoc;
    } else {
      project.evaluationPhases.push(finalPhaseDoc);
    }

    // Grade history entry
    project.gradeHistory.push({
      phase:           "FINAL",
      action:          "SUBMITTED",
      actorId:         supervisorId,
      actorName:       req.user.name || "Supervisor",
      evaluationMarks: project.evaluationMarks,
      memberGrades:    (project.memberGrades || []).map((g) => ({ userId: g.userId, name: g.name, marks: g.marks })),
      remarks:         project.remarks || "",
      timestamp:       new Date(),
    });

    // Recalculate overall from all phases
    project.evaluationMarks = calcOverallFromPhases(project);

    await project.save();

    // Sync status in AssignedProject as well
    await AssignedProject.findOneAndUpdate(
      { projectId: project._id },
      { status: "COMPLETED" }
    );

    await notifyTeamMembers(project, {
      title: "Project Completed",
      message: `Your project "${project.title}" has been marked as completed by your supervisor and is awaiting grade approval.`,
      relatedType: "project",
      relatedId: project._id,
    });

    await logAction({
      actorId: supervisorId,
      actorRole: "supervisor",
      action: "PROJECT_GRADED_COMPLETED",
      targetType: "Project",
      targetId: project._id,
      details: `Marked "${project.title}" complete with evaluation marks ${project.evaluationMarks ?? "N/A"}/100`,
    });

    res.json({ success: true, project });
  } catch (err) {
    console.error("Error completing project:", err);
    res.status(500).json({ message: "Server error while completing project" });
  }
};

// ─────────────────────────────────────────────
// ADMIN GRADE MANAGEMENT
// ─────────────────────────────────────────────

// GET /admin/projects  — every FYP project in the system, any status (Admin overview)
exports.getAllProjectsForAdmin = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate({
        path: "teamId",
        select: "subject members createdBy",
        populate: [
          { path: "members", select: "name email", model: "users" },
          { path: "createdBy", select: "name email", model: "users" },
        ],
      })
      .populate("teamLeaderId", "name email")
      .populate("supervisorId", "name email")
      .populate("departmentId", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, projects });
  } catch (err) {
    console.error("Error fetching all projects for admin:", err);
    res.status(500).json({ message: "Server error while fetching projects" });
  }
};

// GET /admin/projects/grades  — all completed projects for admin review
exports.getCompletedProjectsForAdmin = async (req, res) => {
  try {
    const projects = await Project.find({ status: "COMPLETED" })
      .populate({
        path: "teamId",
        select: "subject members createdBy",
        populate: [
          { path: "members", select: "name email", model: "users" },
          { path: "createdBy", select: "name email", model: "users" },
        ],
      })
      .populate("teamLeaderId", "name email")
      .populate("supervisorId", "name email")
      .populate("departmentId", "name")
      .sort({ completionDate: -1 })
      .lean();
    res.json({ success: true, projects });
  } catch (err) {
    console.error("Error fetching completed projects:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /admin/projects/:projectId/release-grades  — admin releases grades to students
exports.releaseGrades = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { adminRemarks } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.status !== "COMPLETED") {
      return res.status(400).json({ message: "Only completed projects can have grades released" });
    }
    if (project.gradesStatus === "RELEASED") {
      return res.status(400).json({ message: "Grades are already released" });
    }

    project.gradesStatus = "RELEASED";
    project.flaggedReason = "";
    if (adminRemarks !== undefined) project.adminRemarks = adminRemarks;
    await project.save();

    await notifyTeamMembers(project, {
      title: "Grades Released 🎉",
      message: `Grades for your project "${project.title}" have been approved and released. You can now view your marks.`,
      relatedType: "project",
      relatedId: project._id,
    });

    await emailTeamMembers(project, {
      subject: "Grades Released",
      bodyHtml: `<p>Grades for your project "<strong>${project.title}</strong>" have been approved and released. Log in to view your marks.</p>${
        adminRemarks ? `<p><strong>Admin remarks:</strong> ${adminRemarks}</p>` : ""
      }`,
    });

    await logAction({
      actorId: req.user._id,
      actorRole: "admin",
      action: "GRADE_RELEASED",
      targetType: "Project",
      targetId: project._id,
      details: `Released grades for "${project.title}"${adminRemarks ? ` — remarks: ${adminRemarks}` : ""}`,
    });

    res.json({ success: true, message: "Grades released successfully", project });
  } catch (err) {
    console.error("Error releasing grades:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /admin/projects/:projectId/flag-grades  — admin flags grades, returns to supervisor for re-grading
exports.flagGrades = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { flaggedReason } = req.body;

    if (!flaggedReason || !flaggedReason.trim()) {
      return res.status(400).json({ message: "A reason is required when flagging grades" });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.status !== "COMPLETED") {
      return res.status(400).json({ message: "Only completed projects can be flagged" });
    }
    if (project.gradesStatus === "RELEASED") {
      return res.status(400).json({ message: "Cannot flag grades that have already been released" });
    }

    project.gradesStatus = "FLAGGED";
    project.flaggedReason = flaggedReason.trim();
    await project.save();

    await createNotification({
      userId: project.supervisorId,
      title: "Grades Flagged for Re-grading",
      message: `Admin has flagged the grades for project "${project.title}". Reason: ${flaggedReason}. Please review and re-grade.`,
      relatedType: "project",
      relatedId: project._id,
    });

    await logAction({
      actorId: req.user._id,
      actorRole: "admin",
      action: "GRADE_FLAGGED",
      targetType: "Project",
      targetId: project._id,
      details: `Flagged grades for "${project.title}" — reason: ${flaggedReason.trim()}`,
    });

    res.json({ success: true, message: "Project flagged for re-grading", project });
  } catch (err) {
    console.error("Error flagging grades:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /projects/:projectId/regrade  — supervisor re-grades a flagged project
exports.reGradeProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const supervisorId = req.user._id;
    const { evaluationMarks, remarks, memberGrades } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (String(project.supervisorId) !== String(supervisorId)) {
      return res.status(403).json({ message: "Only the assigned supervisor can re-grade this project" });
    }
    if (project.gradesStatus !== "FLAGGED") {
      return res.status(400).json({ message: "Only flagged projects can be re-graded" });
    }

    if (evaluationMarks !== undefined) {
      if (evaluationMarks < 0 || evaluationMarks > 100) {
        return res.status(400).json({ message: "Evaluation marks must be between 0 and 100" });
      }
      project.evaluationMarks = evaluationMarks;
    }
    if (remarks !== undefined) project.remarks = remarks;
    if (memberGrades && Array.isArray(memberGrades) && memberGrades.length > 0) {
      project.memberGrades = memberGrades;
    }

    const capturedFlagReason = project.flaggedReason || "";
    project.gradesStatus = "PENDING_RELEASE";
    project.flaggedReason = "";

    // Update FINAL phase
    const reFinalPhaseDoc = {
      phase:           "FINAL",
      label:           PHASE_CONFIG.FINAL.label,
      weight:          PHASE_CONFIG.FINAL.weight,
      status:          "SUBMITTED",
      submittedAt:     new Date(),
      evaluationMarks: project.evaluationMarks,
      memberGrades:    project.memberGrades,
      remarks:         project.remarks,
    };
    const reFinalIdx = (project.evaluationPhases || []).findIndex((p) => p.phase === "FINAL");
    if (reFinalIdx >= 0) {
      project.evaluationPhases[reFinalIdx] = reFinalPhaseDoc;
    } else {
      project.evaluationPhases.push(reFinalPhaseDoc);
    }

    // Grade history entry for revision
    project.gradeHistory.push({
      phase:           "FINAL",
      action:          "REVISED",
      actorId:         supervisorId,
      actorName:       req.user.name || "Supervisor",
      evaluationMarks: project.evaluationMarks,
      memberGrades:    (project.memberGrades || []).map((g) => ({ userId: g.userId, name: g.name, marks: g.marks })),
      remarks:         project.remarks || "",
      revisionReason:  capturedFlagReason,
      timestamp:       new Date(),
    });

    // Recalculate overall from all phases
    project.evaluationMarks = calcOverallFromPhases(project);

    await project.save();

    await notifyTeamMembers(project, {
      title: "Project Re-graded",
      message: `Your project "${project.title}" has been re-graded by your supervisor and is pending admin approval.`,
      relatedType: "project",
      relatedId: project._id,
    });

    await logAction({
      actorId: supervisorId,
      actorRole: "supervisor",
      action: "PROJECT_REGRADED",
      targetType: "Project",
      targetId: project._id,
      details: `Re-graded "${project.title}" with evaluation marks ${project.evaluationMarks ?? "N/A"}/100`,
    });

    res.json({ success: true, project });
  } catch (err) {
    console.error("Error re-grading project:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /auth/projects/:projectId/grade-phase  (Supervisor)
// Grades INTERNAL or MIDTERM phase — does NOT change project status
exports.gradePhase = async (req, res) => {
  try {
    const { projectId } = req.params;
    const supervisorId  = req.user._id;
    const { phase, memberGrades, remarks } = req.body;

    if (!["INTERNAL", "MIDTERM"].includes(phase)) {
      return res.status(400).json({ message: "phase must be INTERNAL or MIDTERM" });
    }
    if (!Array.isArray(memberGrades) || memberGrades.length === 0) {
      return res.status(400).json({ message: "memberGrades required" });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (String(project.supervisorId) !== String(supervisorId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const cfg     = PHASE_CONFIG[phase];
    const phaseAvg = Math.round(
      memberGrades.reduce((s, g) => s + (g.marks || 0), 0) / memberGrades.length
    );

    // Record history before overwriting
    const existingIdx = (project.evaluationPhases || []).findIndex((p) => p.phase === phase);
    const isRevision  = existingIdx >= 0 && project.evaluationPhases[existingIdx].status === "SUBMITTED";

    project.gradeHistory.push({
      phase,
      action:          isRevision ? "REVISED" : "SUBMITTED",
      actorId:         supervisorId,
      actorName:       req.user.name || "Supervisor",
      evaluationMarks: phaseAvg,
      memberGrades:    memberGrades.map((g) => ({ userId: g.userId, name: g.name, marks: g.marks })),
      remarks:         remarks || "",
      timestamp:       new Date(),
    });

    const phaseDoc = {
      phase,
      label:           cfg.label,
      weight:          cfg.weight,
      status:          "SUBMITTED",
      submittedAt:     new Date(),
      evaluationMarks: phaseAvg,
      memberGrades,
      remarks:         remarks || "",
    };

    if (existingIdx >= 0) {
      project.evaluationPhases[existingIdx] = phaseDoc;
    } else {
      project.evaluationPhases.push(phaseDoc);
    }

    // Recalculate overall (only from submitted phases so far)
    project.evaluationMarks = calcOverallFromPhases(project);

    await project.save();

    await logAction({
      actorId:    supervisorId,
      actorRole:  "supervisor",
      actorName:  req.user.name || "Supervisor",
      action:     `PHASE_${phase}_${isRevision ? "REVISED" : "GRADED"}`,
      targetType: "Project",
      targetId:   project._id,
      details:    `${cfg.label} ${isRevision ? "revised" : "graded"} for "${project.title}": ${phaseAvg}/100`,
    });

    res.json({ success: true, project });
  } catch (err) {
    console.error("gradePhase error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /auth/admin/projects/:projectId/schedule-viva  (Admin)
exports.scheduleViva = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { scheduledAt, venue, examinerName } = req.body;

    if (!scheduledAt) return res.status(400).json({ message: "scheduledAt date is required" });

    const project = await Project.findById(projectId)
      .populate("teamId", "members createdBy")
      .populate("teamLeaderId", "name");
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.status !== "COMPLETED" || project.gradesStatus !== "RELEASED") {
      return res.status(400).json({ message: "Viva can only be scheduled for projects with released grades" });
    }

    project.vivaDetails = {
      ...((project.vivaDetails || {})),
      status:       "SCHEDULED",
      scheduledAt:  new Date(scheduledAt),
      venue:        venue || "",
      examinerName: examinerName || "",
    };

    await project.save();

    // Notify team members and supervisor
    const recipientIds = new Set();
    if (project.teamLeaderId) recipientIds.add(String(project.teamLeaderId._id || project.teamLeaderId));
    (project.memberGrades || []).forEach((mg) => { if (mg.userId) recipientIds.add(String(mg.userId)); });
    const vivaDate = new Date(scheduledAt).toLocaleString();
    const notifMsg = `Your viva defense for "${project.title}" is scheduled on ${vivaDate}${venue ? ` at ${venue}` : ""}${examinerName ? `. Examiner: ${examinerName}` : ""}.`;

    await Promise.all([...recipientIds].map((userId) =>
      createNotification({
        userId,
        title: "Viva Defense Scheduled",
        message: notifMsg,
        relatedType: "project",
        relatedId: project._id,
      })
    ));
    await createNotification({
      userId: project.supervisorId,
      title: "Viva Defense Scheduled",
      message: `Viva for project "${project.title}" scheduled on ${vivaDate}${venue ? ` at ${venue}` : ""}.`,
      relatedType: "project",
      relatedId: project._id,
    });

    await logAction({
      actorId:   req.user._id,
      actorRole: "admin",
      action:    "VIVA_SCHEDULED",
      targetType:"Project",
      targetId:  project._id,
      details:   `Viva scheduled for "${project.title}" on ${vivaDate}`,
    });

    res.json({ success: true, project });
  } catch (err) {
    console.error("scheduleViva error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /auth/admin/projects/:projectId/grade-viva  (Admin)
exports.gradeViva = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { memberVivaGrades, remarks } = req.body;

    if (!Array.isArray(memberVivaGrades) || memberVivaGrades.length === 0) {
      return res.status(400).json({ message: "memberVivaGrades required" });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!project.vivaDetails?.status) {
      return res.status(400).json({ message: "Viva must be scheduled before grading" });
    }

    const vivaAvg = Math.round(
      memberVivaGrades.reduce((s, g) => s + (g.marks || 0), 0) / memberVivaGrades.length
    );
    const supervisorAvg = project.evaluationMarks || 0;

    project.vivaDetails.status          = "GRADED";
    project.vivaDetails.vivaMarks       = vivaAvg;
    project.vivaDetails.memberVivaGrades= memberVivaGrades;
    project.vivaDetails.gradedAt        = new Date();
    project.vivaDetails.remarks         = remarks || "";

    // Recalculate combined marks per member
    const updatedMemberGrades = (project.memberGrades || []).map((mg) => {
      const vivaEntry = memberVivaGrades.find((v) => String(v.userId) === String(mg.userId));
      if (!vivaEntry) return mg;
      const combined = calcOverallFinal(mg.marks || 0, vivaEntry.marks || 0);
      return { ...mg.toObject(), marks: combined };
    });
    project.memberGrades = updatedMemberGrades;

    // Overall combined
    project.overallFinalMarks  = calcOverallFinal(supervisorAvg, vivaAvg);
    project.evaluationMarks    = project.overallFinalMarks;

    // Append to grade history
    project.gradeHistory.push({
      phase:           "VIVA",
      action:          "SUBMITTED",
      actorId:         req.user._id,
      actorName:       req.user.name || "Admin",
      evaluationMarks: vivaAvg,
      memberGrades:    memberVivaGrades.map((g) => ({ userId: g.userId, name: g.name, marks: g.marks })),
      remarks:         remarks || "",
      timestamp:       new Date(),
    });

    await project.save();

    // Notify team
    const recipientIds = new Set();
    (project.memberGrades || []).forEach((mg) => { if (mg.userId) recipientIds.add(String(mg.userId)); });
    await Promise.all([...recipientIds].map((userId) =>
      createNotification({
        userId,
        title: "Viva Results Recorded",
        message: `Viva marks for "${project.title}" have been recorded. Your combined final mark has been updated.`,
        relatedType: "project",
        relatedId: project._id,
      })
    ));

    await logAction({
      actorId:   req.user._id,
      actorRole: "admin",
      action:    "VIVA_GRADED",
      targetType:"Project",
      targetId:  project._id,
      details:   `Viva graded for "${project.title}". Viva avg: ${vivaAvg}/100. Combined avg: ${project.overallFinalMarks}/100`,
    });

    res.json({ success: true, project });
  } catch (err) {
    console.error("gradeViva error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
