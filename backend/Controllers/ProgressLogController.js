const ProgressLog = require("../Models/ProgressLog");
const Project = require("../Models/Project");
const Notification = require("../Models/Notification");

const createNotification = async ({ userId, title, message, relatedType, relatedId }) => {
  try {
    await Notification.create({ userId, title, message, relatedType, relatedId });
  } catch (err) {
    console.error("Notification creation failed:", err);
  }
};

// POST /progress-logs
// Student submits a weekly progress log
exports.submitProgressLog = async (req, res) => {
  try {
    const submittedBy = req.user._id;
    const { projectId, weekNumber, workDone, plannedNext, challenges } = req.body;

    if (!projectId || !weekNumber || !workDone) {
      return res.status(400).json({ message: "projectId, weekNumber, and workDone are required" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (String(project.teamLeaderId) !== String(submittedBy)) {
      return res.status(403).json({ message: "Only the team leader can submit progress logs" });
    }

    // Prevent duplicate log for same week
    const existing = await ProgressLog.findOne({ projectId, weekNumber });
    if (existing) {
      return res.status(400).json({ message: `A progress log for week ${weekNumber} already exists` });
    }

    const log = await ProgressLog.create({
      projectId,
      teamId: project.teamId,
      submittedBy,
      weekNumber,
      workDone,
      plannedNext: plannedNext || "",
      challenges: challenges || "",
    });

    await createNotification({
      userId: project.supervisorId,
      title: "Weekly Progress Log Submitted",
      message: `Team submitted week ${weekNumber} progress log for "${project.title}".`,
      relatedType: "project",
      relatedId: project._id,
    });

    res.status(201).json({ success: true, log });
  } catch (err) {
    console.error("Error submitting progress log:", err);
    res.status(500).json({ message: "Server error while submitting progress log" });
  }
};

// GET /progress-logs/:projectId
// Get all progress logs for a project
exports.getProjectProgressLogs = async (req, res) => {
  try {
    const { projectId } = req.params;

    const logs = await ProgressLog.find({ projectId })
      .populate("submittedBy", "name email")
      .populate("reviewedBy", "name email")
      .sort({ weekNumber: 1 });

    res.json({ success: true, logs });
  } catch (err) {
    console.error("Error fetching progress logs:", err);
    res.status(500).json({ message: "Server error while fetching progress logs" });
  }
};

// PUT /progress-logs/:logId/review
// Supervisor adds feedback to a progress log
exports.reviewProgressLog = async (req, res) => {
  try {
    const { logId } = req.params;
    const supervisorId = req.user._id;
    const { supervisorFeedback } = req.body;

    if (!supervisorFeedback) {
      return res.status(400).json({ message: "supervisorFeedback is required" });
    }

    const log = await ProgressLog.findById(logId);
    if (!log) {
      return res.status(404).json({ message: "Progress log not found" });
    }

    const project = await Project.findById(log.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (String(project.supervisorId) !== String(supervisorId)) {
      return res.status(403).json({ message: "Only the assigned supervisor can review progress logs" });
    }

    log.supervisorFeedback = supervisorFeedback;
    log.supervisorFeedbackAt = new Date();
    log.reviewedBy = supervisorId;
    log.status = "REVIEWED";

    await log.save();

    await createNotification({
      userId: project.teamLeaderId,
      title: "Progress Log Reviewed",
      message: `Your week ${log.weekNumber} progress log for "${project.title}" has been reviewed.`,
      relatedType: "project",
      relatedId: project._id,
    });

    res.json({ success: true, log });
  } catch (err) {
    console.error("Error reviewing progress log:", err);
    res.status(500).json({ message: "Server error while reviewing progress log" });
  }
};
