const EvaluationPhase = require("../Models/EvaluationPhase");

// POST /admin/phases — admin only
exports.createPhase = async (req, res) => {
  try {
    const { name, description, totalMarks, convertToMarks, criteria, panelId, requiresUpload } = req.body;

    if (!name || totalMarks === undefined || convertToMarks === undefined) {
      return res.status(400).json({
        success: false,
        message: "name, totalMarks and convertToMarks are required",
      });
    }

    const phase = await EvaluationPhase.create({
      name,
      description: description || "",
      totalMarks,
      convertToMarks,
      criteria: criteria || [],
      panelId: panelId || null,
      requiresUpload: !!requiresUpload,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, phase });
  } catch (err) {
    console.error("Error creating phase:", err);
    res.status(500).json({ success: false, message: "Server error while creating phase" });
  }
};

// GET /phases — any authenticated role
exports.getAllPhases = async (req, res) => {
  try {
    const phases = await EvaluationPhase.find().populate("panelId", "name").sort({ createdAt: -1 });
    res.json({ success: true, phases });
  } catch (err) {
    console.error("Error fetching phases:", err);
    res.status(500).json({ success: false, message: "Server error while fetching phases" });
  }
};

// PUT /admin/phases/:id — admin only
exports.updatePhase = async (req, res) => {
  try {
    const phase = await EvaluationPhase.findById(req.params.id);
    if (!phase) return res.status(404).json({ success: false, message: "Phase not found" });

    const fields = ["name", "description", "totalMarks", "convertToMarks", "criteria", "panelId", "requiresUpload", "isActive"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) phase[f] = req.body[f];
    });
    await phase.save();

    res.json({ success: true, phase });
  } catch (err) {
    console.error("Error updating phase:", err);
    res.status(500).json({ success: false, message: "Server error while updating phase" });
  }
};

// DELETE /admin/phases/:id — admin only
exports.deletePhase = async (req, res) => {
  try {
    const phase = await EvaluationPhase.findByIdAndDelete(req.params.id);
    if (!phase) return res.status(404).json({ success: false, message: "Phase not found" });
    res.json({ success: true, message: "Phase deleted" });
  } catch (err) {
    console.error("Error deleting phase:", err);
    res.status(500).json({ success: false, message: "Server error while deleting phase" });
  }
};
