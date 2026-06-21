const ProjectReviewNote = require("../Models/ProjectReviewNote");
const Project = require("../Models/Project");
const Notification = require("../Models/Notification");

const createNotification = async ({ userId, title, message, relatedType, relatedId }) => {
  try {
    await Notification.create({ userId, title, message, relatedType, relatedId });
  } catch (err) {
    console.error("Notification creation failed:", err);
  }
};

// POST /review-notes
// Supervisor sends a batch of annotated screenshots (collected while
// browsing the live project) plus one overall remark to the team.
exports.createReviewNote = async (req, res) => {
  try {
    const supervisorId = req.user._id;
    const { projectId, remarks } = req.body;

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "At least one screenshot is required" });
    }

    let annotationsList = [];
    try {
      annotationsList = req.body.annotations ? JSON.parse(req.body.annotations) : [];
    } catch {
      return res.status(400).json({ message: "annotations must be valid JSON" });
    }

    if (!Array.isArray(annotationsList) || annotationsList.length !== req.files.length) {
      return res.status(400).json({
        message: "annotations must be an array with one entry per screenshot",
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (String(project.supervisorId) !== String(supervisorId)) {
      return res.status(403).json({ message: "Only the assigned supervisor can send review notes" });
    }

    const items = req.files.map((file, i) => ({
      screenshotUrl: file.path,
      annotations: annotationsList[i] || [],
    }));

    const reviewNote = await ProjectReviewNote.create({
      projectId,
      supervisorId,
      items,
      remarks: remarks || "",
    });

    const totalIssues = items.reduce((sum, it) => sum + it.annotations.length, 0);

    await createNotification({
      userId: project.teamLeaderId,
      title: "Supervisor Marked Issues on Your Live Project",
      message: `Your supervisor reviewed the live preview of "${project.title}" — ${items.length} screenshot${items.length !== 1 ? "s" : ""}, ${totalIssues} marked issue${totalIssues !== 1 ? "s" : ""}.`,
      relatedType: "project",
      relatedId: project._id,
    });

    res.status(201).json({ success: true, reviewNote });
  } catch (err) {
    console.error("Error creating review note:", err);
    res.status(500).json({ message: "Server error while creating review note" });
  }
};

// GET /review-notes/:projectId
exports.getProjectReviewNotes = async (req, res) => {
  try {
    const { projectId } = req.params;
    const notes = await ProjectReviewNote.find({ projectId })
      .populate("supervisorId", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, reviewNotes: notes });
  } catch (err) {
    console.error("Error fetching review notes:", err);
    res.status(500).json({ message: "Server error while fetching review notes" });
  }
};

// PUT /review-notes/:noteId/resolve
// Team leader marks an entire review session as resolved after fixing the issues
exports.resolveReviewNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user._id;

    const reviewNote = await ProjectReviewNote.findById(noteId);
    if (!reviewNote) {
      return res.status(404).json({ message: "Review note not found" });
    }

    const project = await Project.findById(reviewNote.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (String(project.teamLeaderId) !== String(userId)) {
      return res.status(403).json({ message: "Only the team leader can mark a review note as resolved" });
    }

    reviewNote.status = "RESOLVED";
    reviewNote.resolvedAt = new Date();
    await reviewNote.save();

    await createNotification({
      userId: project.supervisorId,
      title: "Review Note Resolved",
      message: `The team marked your feedback on "${project.title}" as resolved.`,
      relatedType: "project",
      relatedId: project._id,
    });

    res.json({ success: true, reviewNote });
  } catch (err) {
    console.error("Error resolving review note:", err);
    res.status(500).json({ message: "Server error while resolving review note" });
  }
};
