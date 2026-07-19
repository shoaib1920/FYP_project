const Project = require("../Models/Project");
const Notification = require("../Models/Notification");
const AssignedProject = require("../Models/SupervisorModels/AssignedProject");
const Users = require("../Models/Users");
const AcademicTerm = require("../Models/AcademicTerm");
const Team = require("../Models/Team");
const MeetingLog = require("../Models/MeetingLog");
const Admin = require("../Models/Admin/AdminAuth");
const sendEmail = require("../utils/emailService");
const { logAction } = require("./AuditLogController");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const { analyzeFinalReportQuality } = require("../utils/geminiService");

// Extracts text from a locally-stored report PDF and runs it through the AI
// quality check — best-effort, must never throw or block report submission.
const runReportQualityCheck = async (localFilePath) => {
  try {
    const buffer = fs.readFileSync(localFilePath);
    const parsed = await pdfParse(buffer);
    const text = (parsed.text || "").trim();
    if (!text) return null; // scanned/image-only PDF, nothing to analyze
    const result = await analyzeFinalReportQuality(text);
    return { ...result, checkedAt: new Date() };
  } catch (err) {
    console.error("Final report AI quality check failed:", err.message);
    return null;
  }
};

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

    const qualityCheck = await runReportQualityCheck(req.file.path);
    if (qualityCheck) {
      project.reportQualityCheck = qualityCheck;
      await project.save();
    }

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

// PUT /projects/:projectId/request-appeal — team leader appeals an already-
// RELEASED grade. This is the only path to revisit a grade after release
// (flagGrades only works pre-release); accepting the appeal reopens grading
// via the existing FLAGGED status/re-grade flow.
exports.requestGradeAppeal = async (req, res) => {
  try {
    const { projectId } = req.params;
    const studentId = req.user._id;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "Please explain why you're requesting a grade review" });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (String(project.teamLeaderId) !== String(studentId)) {
      return res.status(403).json({ message: "Only the team leader can request a grade appeal" });
    }
    if (project.gradesStatus !== "RELEASED") {
      return res.status(400).json({ message: "Grades must be released before you can appeal them" });
    }
    if (project.gradeAppeal?.status === "REQUESTED") {
      return res.status(400).json({ message: "You already have a pending appeal for this project" });
    }

    const student = await Users.findById(studentId).select("name");

    project.gradeAppeal = {
      status: "REQUESTED",
      reason: reason.trim(),
      requestedBy: studentId,
      requestedByName: student?.name || "Team leader",
      requestedAt: new Date(),
      adminResponse: "",
      respondedAt: null,
    };
    await project.save();

    const admins = await Admin.find().select("_id");
    await Promise.all(admins.map((a) =>
      createNotification({
        userId: a._id,
        title: "Grade Appeal Requested",
        message: `${student?.name || "A student"} requested a grade review for "${project.title}". Reason: ${reason.trim()}`,
        relatedType: "project",
        relatedId: project._id,
      })
    ));

    res.json({ success: true, message: "Your appeal has been sent to the admin", gradeAppeal: project.gradeAppeal });
  } catch (err) {
    console.error("requestGradeAppeal error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /admin/projects/:projectId/resolve-appeal — admin accepts (reopens
// grading via FLAGGED) or rejects (grade stands) a pending appeal.
exports.resolveGradeAppeal = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { action, adminResponse } = req.body; // "ACCEPT" | "REJECT"

    if (!["ACCEPT", "REJECT"].includes(action)) {
      return res.status(400).json({ message: "action must be 'ACCEPT' or 'REJECT'" });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.gradeAppeal?.status !== "REQUESTED") {
      return res.status(400).json({ message: "No pending appeal found for this project" });
    }

    project.gradeAppeal.status = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";
    project.gradeAppeal.adminResponse = adminResponse || "";
    project.gradeAppeal.respondedAt = new Date();

    if (action === "ACCEPT") {
      project.gradesStatus = "FLAGGED";
      project.flaggedReason = `Grade appeal accepted: ${project.gradeAppeal.reason}`;
    }
    await project.save();

    await createNotification({
      userId: project.teamLeaderId,
      title: action === "ACCEPT" ? "Grade Appeal Accepted" : "Grade Appeal Rejected",
      message: action === "ACCEPT"
        ? `Your appeal for "${project.title}" was accepted. Your supervisor will re-grade the project.${adminResponse ? ` Admin note: ${adminResponse}` : ""}`
        : `Your appeal for "${project.title}" was reviewed and the grade stands.${adminResponse ? ` Admin note: ${adminResponse}` : ""}`,
      relatedType: "project",
      relatedId: project._id,
    });

    if (action === "ACCEPT") {
      await createNotification({
        userId: project.supervisorId,
        title: "Grade Appeal Accepted — Re-grade Needed",
        message: `An admin accepted a grade appeal for "${project.title}". Please review and re-grade.`,
        relatedType: "project",
        relatedId: project._id,
      });
    }

    await logAction({
      actorId: req.user._id,
      actorRole: "admin",
      action: action === "ACCEPT" ? "GRADE_APPEAL_ACCEPTED" : "GRADE_APPEAL_REJECTED",
      targetType: "Project",
      targetId: project._id,
      details: `${action === "ACCEPT" ? "Accepted" : "Rejected"} grade appeal for "${project.title}"`,
    });

    res.json({ success: true, project });
  } catch (err) {
    console.error("resolveGradeAppeal error:", err);
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
// POST /projects/:projectId/analyze-report — supervisor re-runs the AI
// quality check on demand (e.g. the automatic one failed, or they want a
// fresh read). Does not require UNDER_REVIEW status so it still works if
// re-grading later.
exports.analyzeFinalReport = async (req, res) => {
  try {
    const { projectId } = req.params;
    const supervisorId = req.user._id;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (String(project.supervisorId) !== String(supervisorId)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (!project.finalReportUrl) {
      return res.status(400).json({ message: "No final report has been submitted for this project yet" });
    }

    const qualityCheck = await runReportQualityCheck(project.finalReportUrl);
    if (!qualityCheck) {
      return res.status(500).json({ message: "AI quality check failed — the report file may be missing, image-only, or the AI service is unavailable." });
    }

    project.reportQualityCheck = qualityCheck;
    await project.save();

    res.json({ success: true, reportQualityCheck: qualityCheck });
  } catch (err) {
    console.error("analyzeFinalReport error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /projects/:projectId/grade-draft — save partial, in-progress rubric
// scores without submitting/finalizing anything. No status change, no
// notifications — purely a scratchpad so a supervisor can grade a few
// members now and finish the rest later without losing work.
exports.saveGradeDraft = async (req, res) => {
  try {
    const { projectId } = req.params;
    const supervisorId = req.user._id;
    const { phase, rubricScores, remarks } = req.body;

    if (!phase) return res.status(400).json({ message: "phase is required" });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (String(project.supervisorId) !== String(supervisorId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    project.gradingDraft = {
      phase,
      rubricScores: rubricScores || {},
      remarks: remarks || "",
      savedAt: new Date(),
    };
    await project.save();

    res.json({ success: true, gradingDraft: project.gradingDraft });
  } catch (err) {
    console.error("saveGradeDraft error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

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
    const { scheduledAt, mode, venue, meetingLink, durationMinutes, instructions, examiners } = req.body;

    if (!scheduledAt) return res.status(400).json({ message: "scheduledAt date is required" });

    const project = await Project.findById(projectId)
      .populate("teamId", "members createdBy")
      .populate("teamLeaderId", "name");
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.status !== "COMPLETED" || project.gradesStatus !== "RELEASED") {
      return res.status(400).json({ message: "Viva can only be scheduled for projects with released grades" });
    }

    const cleanExaminers = Array.isArray(examiners)
      ? examiners.filter((e) => e && e.name && e.name.trim()).map((e) => ({ name: e.name.trim(), role: (e.role || "").trim() }))
      : [];
    const resolvedMode = mode === "ONLINE" ? "ONLINE" : "IN_PERSON";

    project.vivaDetails = {
      ...((project.vivaDetails || {})),
      status:           "SCHEDULED",
      scheduledAt:      new Date(scheduledAt),
      mode:             resolvedMode,
      venue:            resolvedMode === "IN_PERSON" ? (venue || "") : "",
      meetingLink:      resolvedMode === "ONLINE" ? (meetingLink || "") : "",
      durationMinutes:  Number(durationMinutes) || 30,
      instructions:     instructions || "",
      examiners:        cleanExaminers,
      examinerName:     cleanExaminers.map((e) => e.name).join(", "),
      remindersSent:    [],
    };

    await project.save();

    // Notify team members and supervisor
    const recipientIds = new Set();
    if (project.teamLeaderId) recipientIds.add(String(project.teamLeaderId._id || project.teamLeaderId));
    (project.memberGrades || []).forEach((mg) => { if (mg.userId) recipientIds.add(String(mg.userId)); });
    const vivaDate = new Date(scheduledAt).toLocaleString();
    const locationBit = resolvedMode === "ONLINE"
      ? (meetingLink ? ` — join online: ${meetingLink}` : " — online (link to follow)")
      : (venue ? ` at ${venue}` : "");
    const examinerBit = cleanExaminers.length ? `. Panel: ${cleanExaminers.map((e) => e.role ? `${e.name} (${e.role})` : e.name).join(", ")}` : "";
    const notifMsg = `Your viva defense for "${project.title}" is scheduled on ${vivaDate}${locationBit}${examinerBit}.`;

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
      message: `Viva for project "${project.title}" scheduled on ${vivaDate}${locationBit}.`,
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

// Fires a "Viva Reminder" notification (3 days out, then 1 day out) to the
// student team, the assigned supervisor, AND all admins — previously this
// only reached the student team, so neither the supervisor nor admin ever
// got an actual push notification (only a passive dashboard widget for
// supervisors, and nothing at all for admin). Piggy-backed on whichever
// dashboard load crosses a threshold first (student's viva banner or
// supervisor's upcoming schedule) instead of a separate cron job.
const checkAndFireVivaReminders = async (project, team = null) => {
  if (project.vivaDetails?.status !== "SCHEDULED") return;

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntil = Math.ceil((new Date(project.vivaDetails.scheduledAt).getTime() - Date.now()) / msPerDay);
  const thresholds = [3, 1];
  const alreadySent = project.vivaDetails.remindersSent || [];
  const due = thresholds.filter((t) => daysUntil <= t && daysUntil >= 0 && !alreadySent.includes(t));
  if (due.length === 0) return;

  const resolvedTeam = team || (await Team.findById(project.teamId?._id || project.teamId).select("members createdBy"));
  const admins = await Admin.find().select("_id");

  const recipientIds = new Set();
  if (resolvedTeam) {
    recipientIds.add(String(resolvedTeam.createdBy));
    resolvedTeam.members.forEach((m) => recipientIds.add(String(m)));
  }
  if (project.supervisorId) recipientIds.add(String(project.supervisorId));
  admins.forEach((a) => recipientIds.add(String(a._id)));

  const when = daysUntil <= 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;
  const when24 = new Date(project.vivaDetails.scheduledAt).toLocaleString();

  await Promise.all([...recipientIds].map((uid) =>
    createNotification({
      userId: uid,
      title: "Viva Reminder",
      message: `Reminder: the viva defense for "${project.title}" is ${when} (${when24}).`,
      relatedType: "project",
      relatedId: project._id,
    })
  ));

  project.vivaDetails.remindersSent = [...alreadySent, ...due];
  await project.save();
};

// GET /my-viva — the logged-in student's own upcoming/recent viva, if any.
// Also opportunistically fires a reminder notification (see
// checkAndFireVivaReminders above) the first time this loads after each
// threshold is crossed, since students hit this endpoint on every
// Dashboard/Project page load.
exports.getMyViva = async (req, res) => {
  try {
    const userId = req.user._id;

    const team = await Team.findOne({ members: userId }).select("_id members createdBy");
    if (!team) return res.json({ success: true, viva: null });

    const project = await Project.findOne({
      teamId: team._id,
      "vivaDetails.status": { $in: ["SCHEDULED", "GRADED"] },
    });

    if (!project || !project.vivaDetails?.status) {
      return res.json({ success: true, viva: null });
    }

    await checkAndFireVivaReminders(project, team);

    res.json({
      success: true,
      viva: {
        projectId: project._id,
        projectTitle: project.title,
        ...project.vivaDetails.toObject(),
      },
    });
  } catch (err) {
    console.error("getMyViva error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /supervisor/schedule — a consolidated, chronological list of the
// logged-in supervisor's upcoming vivas and meetings across ALL their
// projects, instead of only being visible as a per-project inline chip.
exports.getSupervisorSchedule = async (req, res) => {
  try {
    const supervisorId = req.user._id;
    const now = new Date();

    const [projectsWithViva, upcomingMeetings] = await Promise.all([
      Project.find({
        supervisorId,
        "vivaDetails.status": "SCHEDULED",
        "vivaDetails.scheduledAt": { $gte: now },
      })
        .select("title vivaDetails teamId supervisorId")
        .populate("teamId", "subject"),
      MeetingLog.find({ supervisorId, status: "SCHEDULED", scheduledAt: { $gte: now } })
        .populate("projectId", "title")
        .sort({ scheduledAt: 1 }),
    ]);

    // Piggy-back the same reminder check used on the student side, so the
    // reminder fires reliably whichever role opens their dashboard first.
    await Promise.all(projectsWithViva.map((p) => checkAndFireVivaReminders(p)));

    const items = [
      ...projectsWithViva.map((p) => ({
        type: "VIVA",
        date: p.vivaDetails.scheduledAt,
        projectId: p._id,
        projectTitle: p.title,
        teamName: p.teamId?.subject || "",
        mode: p.vivaDetails.mode,
        venue: p.vivaDetails.venue,
        meetingLink: p.vivaDetails.meetingLink,
        durationMinutes: p.vivaDetails.durationMinutes,
        examiners: p.vivaDetails.examiners || [],
      })),
      ...upcomingMeetings.map((m) => ({
        type: "MEETING",
        date: m.scheduledAt,
        projectId: m.projectId?._id,
        projectTitle: m.projectId?.title || "",
        agenda: m.agenda,
        meetingId: m._id,
      })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ success: true, items });
  } catch (err) {
    console.error("getSupervisorSchedule error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
