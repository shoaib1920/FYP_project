const Template = require("../Models/Template");
const Project  = require("../Models/Project");   // new FYP project model
const Team     = require("../Models/Team");
const path     = require("path");
const fs       = require("fs");

// ─────────────────────────────────────────────
// POST /templates/global   (Admin only)
// ─────────────────────────────────────────────
exports.uploadGlobalTemplate = async (req, res) => {
  try {
    const { title, description, category, uploadedByName } = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: "title and category are required" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const ALLOWED = ["Proposal", "Progress Report", "Final Report", "Defense", "General"];
    if (!ALLOWED.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const fileType = path.extname(req.file.originalname).slice(1).toLowerCase();
    const fileUrl  = req.file.path;

    const template = await Template.create({
      title,
      description: description || "",
      scope:          "GLOBAL",
      category,
      uploadedBy:     req.user._id,
      uploadedByRole: "admin",
      uploadedByName: uploadedByName || "Admin",
      fileName:     req.file.filename,
      originalName: req.file.originalname,
      fileType,
      fileUrl,
    });

    res.status(201).json({ success: true, template: template.toPublic() });
  } catch (err) {
    console.error("uploadGlobalTemplate error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /templates/project   (Supervisor only)
// ─────────────────────────────────────────────
exports.uploadProjectTemplate = async (req, res) => {
  try {
    const { title, description, category, fypProjectId, uploadedByName } = req.body;

    if (!title || !category || !fypProjectId) {
      return res.status(400).json({ error: "title, category and fypProjectId are required" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const project = await Project.findById(fypProjectId).lean();
    if (!project) return res.status(404).json({ error: "FYP project not found" });

    // Verify supervisor owns this project
    if (String(project.supervisorId) !== String(req.user._id)) {
      return res.status(403).json({ error: "You can only upload templates for your own projects" });
    }

    const fileType = path.extname(req.file.originalname).slice(1).toLowerCase();
    const fileUrl  = req.file.path;

    const template = await Template.create({
      title,
      description: description || "",
      scope:          "PROJECT",
      category,
      uploadedBy:     req.user._id,
      uploadedByRole: "supervisor",
      uploadedByName: uploadedByName || "Supervisor",
      fypProjectId:   project._id,
      teamId:         project.teamId,
      fileName:     req.file.filename,
      originalName: req.file.originalname,
      fileType,
      fileUrl,
    });

    res.status(201).json({ success: true, template: template.toPublic() });
  } catch (err) {
    console.error("uploadProjectTemplate error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /templates/global   — all GLOBAL templates (any role)
// ─────────────────────────────────────────────
exports.getGlobalTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ scope: "GLOBAL" }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /templates/project/:fypProjectId   — PROJECT templates for one project
// ─────────────────────────────────────────────
exports.getProjectTemplates = async (req, res) => {
  try {
    const { fypProjectId } = req.params;
    const templates = await Template.find({ scope: "PROJECT", fypProjectId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /templates/supervisor   — templates uploaded by logged-in supervisor
// ─────────────────────────────────────────────
exports.getSupervisorTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ uploadedBy: req.user._id, scope: "PROJECT" })
      .populate("fypProjectId", "title")
      .populate("teamId", "subject")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /templates/admin   — GLOBAL templates uploaded by admin (for admin list)
// ─────────────────────────────────────────────
exports.getAdminTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ uploadedBy: req.user._id, scope: "GLOBAL" })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /templates/:id
// ─────────────────────────────────────────────
exports.deleteTemplate = async (req, res) => {
  try {
    const tpl = await Template.findByIdAndDelete(req.params.id);
    if (!tpl) return res.status(404).json({ error: "Not found" });

    const localPath = path.join(__dirname, "..", "uploads", "templates", tpl.fileName);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);

    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("deleteTemplate error:", err);
    res.status(400).json({ error: err.message });
  }
};

// kept for legacy callers that still hit the old routes
exports.getAllTemplates    = exports.getGlobalTemplates;
exports.createTemplate     = exports.uploadGlobalTemplate;
exports.getTemplateById    = (req, res) => res.status(410).json({ error: "Use /templates/global or /templates/project/:id" });
exports.updateTemplate     = (req, res) => res.status(410).json({ error: "Update not supported" });
