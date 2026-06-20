const Project = require("../Models/Project");
const Notification = require("../Models/Notification");
const AssignedProject = require("../Models/SupervisorModels/AssignedProject");
const Users = require("../Models/Users");
const AcademicTerm = require("../Models/AcademicTerm");
const sendEmail = require("../utils/emailService");

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

    project.gradesStatus = "PENDING_RELEASE";
    project.flaggedReason = "";
    await project.save();

    await notifyTeamMembers(project, {
      title: "Project Re-graded",
      message: `Your project "${project.title}" has been re-graded by your supervisor and is pending admin approval.`,
      relatedType: "project",
      relatedId: project._id,
    });

    res.json({ success: true, project });
  } catch (err) {
    console.error("Error re-grading project:", err);
    res.status(500).json({ message: "Server error" });
  }
};
