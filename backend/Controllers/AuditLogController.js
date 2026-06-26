const AuditLog = require("../Models/AuditLog");

// Internal helper — called from other controllers right after a
// grade/status-changing action. Never throws: logging must not break
// the action it's recording.
exports.logAction = async ({ actorId, actorRole, actorName, action, targetType, targetId, details }) => {
  try {
    await AuditLog.create({ actorId, actorRole, actorName: actorName || "", action, targetType, targetId, details: details || "" });
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
};

// GET /admin/audit-logs?targetType=&action=&page=&limit=
exports.getAuditLogs = async (req, res) => {
  try {
    const { targetType, action, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (targetType) filter.targetType = targetType;
    if (action) filter.action = action;

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ success: true, logs, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    res.status(500).json({ message: "Server error while fetching audit logs" });
  }
};

// GET /admin/audit-logs/actions — distinct action types, for a filter dropdown
exports.getAuditActionTypes = async (req, res) => {
  try {
    const actions = await AuditLog.distinct("action");
    res.json({ success: true, actions: actions.sort() });
  } catch (err) {
    console.error("Error fetching audit action types:", err);
    res.status(500).json({ message: "Server error" });
  }
};
