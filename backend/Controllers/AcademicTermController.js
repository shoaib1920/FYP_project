const AcademicTerm = require("../Models/AcademicTerm");

// POST /admin/academic-terms  (Admin)
exports.createTerm = async (req, res) => {
  try {
    const { name, proposalDeadline, finalSubmissionDeadline, isActive } = req.body;

    if (!name || !proposalDeadline || !finalSubmissionDeadline) {
      return res.status(400).json({ message: "Name, proposal deadline, and final submission deadline are required." });
    }

    if (isActive) {
      await AcademicTerm.updateMany({}, { isActive: false });
    }

    const term = await AcademicTerm.create({
      name,
      proposalDeadline,
      finalSubmissionDeadline,
      isActive: !!isActive,
    });

    res.status(201).json({ success: true, term });
  } catch (error) {
    console.error("Error creating academic term:", error);
    res.status(500).json({ message: "Server error while creating academic term." });
  }
};

// GET /admin/academic-terms  (Admin)
exports.getAllTerms = async (req, res) => {
  try {
    const terms = await AcademicTerm.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, terms });
  } catch (error) {
    console.error("Error fetching academic terms:", error);
    res.status(500).json({ message: "Server error while fetching academic terms." });
  }
};

// PUT /admin/academic-terms/:id  (Admin)
exports.updateTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, proposalDeadline, finalSubmissionDeadline } = req.body;

    const term = await AcademicTerm.findById(id);
    if (!term) return res.status(404).json({ message: "Academic term not found." });

    if (name !== undefined) term.name = name;
    if (proposalDeadline !== undefined) term.proposalDeadline = proposalDeadline;
    if (finalSubmissionDeadline !== undefined) term.finalSubmissionDeadline = finalSubmissionDeadline;

    await term.save();
    res.status(200).json({ success: true, term });
  } catch (error) {
    console.error("Error updating academic term:", error);
    res.status(500).json({ message: "Server error while updating academic term." });
  }
};

// DELETE /admin/academic-terms/:id  (Admin)
exports.deleteTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const term = await AcademicTerm.findByIdAndDelete(id);
    if (!term) return res.status(404).json({ message: "Academic term not found." });
    res.status(200).json({ success: true, message: "Academic term deleted." });
  } catch (error) {
    console.error("Error deleting academic term:", error);
    res.status(500).json({ message: "Server error while deleting academic term." });
  }
};

// PUT /admin/academic-terms/:id/activate  (Admin) — only one term can be active at a time
exports.activateTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const term = await AcademicTerm.findById(id);
    if (!term) return res.status(404).json({ message: "Academic term not found." });

    await AcademicTerm.updateMany({}, { isActive: false });
    term.isActive = true;
    await term.save();

    res.status(200).json({ success: true, term });
  } catch (error) {
    console.error("Error activating academic term:", error);
    res.status(500).json({ message: "Server error while activating academic term." });
  }
};

// GET /academic-terms/current  (any authenticated role)
exports.getCurrentTerm = async (req, res) => {
  try {
    const term = await AcademicTerm.findOne({ isActive: true });
    res.status(200).json({ success: true, term: term || null });
  } catch (error) {
    console.error("Error fetching current academic term:", error);
    res.status(500).json({ message: "Server error while fetching current academic term." });
  }
};
