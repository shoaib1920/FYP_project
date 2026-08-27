const PhaseDocument = require("../Models/PhaseDocument");
const PhaseSchedule = require("../Models/PhaseSchedule");

// POST /student/phase-documents — student uploads a document for a scheduled phase
exports.uploadDocument = async (req, res) => {
  try {
    const { phaseScheduleId, teamId } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "A file is required" });
    if (!phaseScheduleId || !teamId) {
      return res.status(400).json({ success: false, message: "phaseScheduleId and teamId are required" });
    }

    const schedule = await PhaseSchedule.findById(phaseScheduleId);
    if (!schedule) return res.status(404).json({ success: false, message: "Schedule not found" });

    const isLate = new Date() > new Date(schedule.scheduledDate);

    const doc = await PhaseDocument.create({
      phaseId: schedule.phaseId,
      phaseScheduleId,
      teamId,
      uploadedBy: req.user._id,
      fileUrl: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      isLate,
    });

    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    console.error("Error uploading phase document:", err);
    res.status(500).json({ success: false, message: "Server error while uploading document" });
  }
};

// GET /phase-documents — admin/faculty view, filterable by ?phaseId=&teamId=
exports.getDocuments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.phaseId) filter.phaseId = req.query.phaseId;
    if (req.query.teamId) filter.teamId = req.query.teamId;

    const documents = await PhaseDocument.find(filter)
      .populate("phaseId", "name")
      .populate("teamId", "subject")
      .populate("uploadedBy", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, documents });
  } catch (err) {
    console.error("Error fetching phase documents:", err);
    res.status(500).json({ success: false, message: "Server error while fetching documents" });
  }
};

// GET /student/phase-documents/:teamId — a team's own upload status per scheduled phase
exports.getTeamDocuments = async (req, res) => {
  try {
    const documents = await PhaseDocument.find({ teamId: req.params.teamId })
      .populate("phaseId", "name")
      .sort({ createdAt: -1 });
    res.json({ success: true, documents });
  } catch (err) {
    console.error("Error fetching team documents:", err);
    res.status(500).json({ success: false, message: "Server error while fetching documents" });
  }
};
