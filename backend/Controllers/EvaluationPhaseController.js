const EvaluationPhase = require("../Models/EvaluationPhase");
const EvaluationPanel = require("../Models/EvaluationPanel");

const STAGES = ["GENERAL", "INTERNAL", "SUPERVISOR", "EXTERNAL"];

// An INTERNAL/EXTERNAL phase is marked by a panel of the matching type; a
// SUPERVISOR phase is marked by the group's supervisor and takes no panel.
// Returns an error message, or null if the stage/panel combination is valid.
async function validateStagePanel(stage, panelId) {
  if (!STAGES.includes(stage)) return "Invalid stage";
  if (stage === "INTERNAL" || stage === "EXTERNAL") {
    const label = stage === "INTERNAL" ? "internal" : "external";
    if (!panelId) return `Select the ${label} panel that will mark this phase`;
    const panel = await EvaluationPanel.findById(panelId);
    if (!panel) return "Selected panel not found";
    if ((panel.type || "INTERNAL") !== stage) {
      return `"${panel.name}" is not an ${label} panel — choose an ${label} panel for this phase`;
    }
  }
  return null;
}

// POST /admin/phases — admin only
exports.createPhase = async (req, res) => {
  try {
    const { name, description, totalMarks, convertToMarks, criteria, panelId, requiresUpload } = req.body;
    const stage = req.body.stage || "GENERAL";

    if (!name || totalMarks === undefined || convertToMarks === undefined) {
      return res.status(400).json({
        success: false,
        message: "name, totalMarks and convertToMarks are required",
      });
    }

    const stageError = await validateStagePanel(stage, panelId);
    if (stageError) return res.status(400).json({ success: false, message: stageError });

    const phase = await EvaluationPhase.create({
      name,
      description: description || "",
      totalMarks,
      convertToMarks,
      criteria: criteria || [],
      stage,
      panelId: stage === "SUPERVISOR" ? null : panelId || null,
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
    const phases = await EvaluationPhase.find().populate("panelId", "name type").sort({ createdAt: -1 });
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

    const fields = ["name", "description", "totalMarks", "convertToMarks", "criteria", "stage", "panelId", "requiresUpload", "isActive"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) phase[f] = req.body[f];
    });

    // Only re-check the stage/panel pairing when one of them is being changed,
    // so unrelated edits (e.g. toggling isActive) never trip over it.
    if (req.body.stage !== undefined || req.body.panelId !== undefined) {
      const stageError = await validateStagePanel(phase.stage, phase.panelId);
      if (stageError) return res.status(400).json({ success: false, message: stageError });
      if (phase.stage === "SUPERVISOR") phase.panelId = null;
    }
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
