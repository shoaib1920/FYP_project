const AcademicSession = require("../Models/AcademicSession");
const Proposal = require("../Models/Proposal");
const Project = require("../Models/Project");

// POST /admin/sessions — admin only
exports.createSession = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Session name is required" });

    const existing = await AcademicSession.findOne({ name });
    if (existing) return res.status(400).json({ success: false, message: "A session with this name already exists" });

    const session = await AcademicSession.create({ name });
    res.status(201).json({ success: true, session });
  } catch (err) {
    console.error("Error creating session:", err);
    res.status(500).json({ success: false, message: "Server error while creating session" });
  }
};

// GET /sessions — any authenticated role
exports.getAllSessions = async (req, res) => {
  try {
    const sessions = await AcademicSession.find().sort({ name: 1 });
    res.json({ success: true, sessions });
  } catch (err) {
    console.error("Error fetching sessions:", err);
    res.status(500).json({ success: false, message: "Server error while fetching sessions" });
  }
};

// PUT /admin/sessions/:id — admin only (rename or toggle isActive)
exports.updateSession = async (req, res) => {
  try {
    const session = await AcademicSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    const { name, isActive } = req.body;
    if (name !== undefined) session.name = name;
    if (isActive !== undefined) session.isActive = isActive;
    await session.save();

    res.json({ success: true, session });
  } catch (err) {
    console.error("Error updating session:", err);
    res.status(500).json({ success: false, message: "Server error while updating session" });
  }
};

// DELETE /admin/sessions/:id — admin only, blocked if any team already uses it
exports.deleteSession = async (req, res) => {
  try {
    const session = await AcademicSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    const inUse =
      (await Proposal.exists({ academicSession: session.name })) ||
      (await Project.exists({ academicSession: session.name }));
    if (inUse) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete "${session.name}" — it is already in use by existing proposals/projects. Deactivate it instead.`,
      });
    }

    await session.deleteOne();
    res.json({ success: true, message: "Session deleted" });
  } catch (err) {
    console.error("Error deleting session:", err);
    res.status(500).json({ success: false, message: "Server error while deleting session" });
  }
};
