const EvaluationPanel = require("../Models/EvaluationPanel");

// POST /admin/panels — admin only
exports.createPanel = async (req, res) => {
  try {
    const { name, description, members } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Panel name is required" });
    }

    const panel = await EvaluationPanel.create({
      name,
      description: description || "",
      members: members || [],
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, panel });
  } catch (err) {
    console.error("Error creating panel:", err);
    res.status(500).json({ success: false, message: "Server error while creating panel" });
  }
};

// GET /panels — any authenticated role (dropdowns, "My Panel")
exports.getAllPanels = async (req, res) => {
  try {
    const panels = await EvaluationPanel.find()
      .populate("members", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, panels });
  } catch (err) {
    console.error("Error fetching panels:", err);
    res.status(500).json({ success: false, message: "Server error while fetching panels" });
  }
};

// GET /faculty/my-panels — panels the logged-in supervisor belongs to
exports.getMyPanels = async (req, res) => {
  try {
    const panels = await EvaluationPanel.find({ members: req.user._id })
      .populate("members", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, panels });
  } catch (err) {
    console.error("Error fetching my panels:", err);
    res.status(500).json({ success: false, message: "Server error while fetching panels" });
  }
};

// PUT /admin/panels/:id — admin only
exports.updatePanel = async (req, res) => {
  try {
    const { name, description, members, isActive } = req.body;
    const panel = await EvaluationPanel.findById(req.params.id);
    if (!panel) return res.status(404).json({ success: false, message: "Panel not found" });

    if (name !== undefined) panel.name = name;
    if (description !== undefined) panel.description = description;
    if (members !== undefined) panel.members = members;
    if (isActive !== undefined) panel.isActive = isActive;
    await panel.save();

    res.json({ success: true, panel });
  } catch (err) {
    console.error("Error updating panel:", err);
    res.status(500).json({ success: false, message: "Server error while updating panel" });
  }
};

// DELETE /admin/panels/:id — admin only
exports.deletePanel = async (req, res) => {
  try {
    const panel = await EvaluationPanel.findByIdAndDelete(req.params.id);
    if (!panel) return res.status(404).json({ success: false, message: "Panel not found" });
    res.json({ success: true, message: "Panel deleted" });
  } catch (err) {
    console.error("Error deleting panel:", err);
    res.status(500).json({ success: false, message: "Server error while deleting panel" });
  }
};
