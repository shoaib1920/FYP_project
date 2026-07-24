const mongoose = require("mongoose");
const Department = require("../Models/Department");
const DepartmentMessage = require("../Models/DepartmentMessage");
const Users = require("../Models/Users");
const Supervisor = require("../Models/supervisorModel");
const {
  getDepartmentIdsForUser,
  canAccessDepartmentChat,
  isAdminUser,
} = require("../utils/departmentChatMembership");

// GET /department-chat/my-departments — every department-wide chat the
// logged-in user belongs to (one for student/supervisor, all of them for admin).
exports.getMyDepartments = async (req, res) => {
  try {
    const userId = req.user._id;
    const deptIds = await getDepartmentIdsForUser(userId);
    if (deptIds.length === 0) {
      return res.status(200).json({ success: true, departments: [] });
    }

    const departments = await Department.find({ _id: { $in: deptIds } })
      .select("name code")
      .lean();

    res.status(200).json({ success: true, departments });
  } catch (error) {
    console.error("Error fetching my department chats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch department chats" });
  }
};

// GET /department-chat/:departmentId/messages
exports.getDepartmentMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { departmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({ success: false, message: "Invalid department ID" });
    }

    const allowed = await canAccessDepartmentChat(userId, departmentId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: "You don't have access to this department's chat" });
    }

    const messages = await DepartmentMessage.find({ departmentId }).sort({ timestamp: 1 });

    await DepartmentMessage.updateMany(
      { departmentId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching department messages:", error);
    res.status(500).json({ success: false, message: "Failed to fetch department messages" });
  }
};

// GET /admin/department-chat/:departmentId/members  (admin only)
// Every student/supervisor in the department, plus their current mute/exclude status.
exports.getModerationMembers = async (req, res) => {
  try {
    const { departmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({ success: false, message: "Invalid department ID" });
    }

    const department = await Department.findById(departmentId).select("mutedMembers excludedMembers");
    if (!department) return res.status(404).json({ success: false, message: "Department not found" });

    const mutedSet = new Set((department.mutedMembers || []).map(String));
    const excludedSet = new Set((department.excludedMembers || []).map(String));

    const [students, supervisors] = await Promise.all([
      Users.find({ department: departmentId }).select("name email").lean(),
      Supervisor.find({ department: departmentId }).select("name email").lean(),
    ]);

    const members = [
      ...students.map((s) => ({ _id: s._id, name: s.name, email: s.email, role: "Student" })),
      ...supervisors.map((s) => ({ _id: s._id, name: s.name, email: s.email, role: "Supervisor" })),
    ].map((m) => ({
      ...m,
      muted: mutedSet.has(String(m._id)),
      excluded: excludedSet.has(String(m._id)),
    }));

    res.status(200).json({ success: true, members });
  } catch (error) {
    console.error("Error fetching department chat members:", error);
    res.status(500).json({ success: false, message: "Failed to fetch department chat members" });
  }
};

const toggleMembership = (field, add) => async (req, res) => {
  try {
    const { departmentId, userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(departmentId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    if (await isAdminUser(userId)) {
      return res.status(400).json({ success: false, message: "Admins can't be muted or excluded" });
    }

    const update = add ? { $addToSet: { [field]: userId } } : { $pull: { [field]: userId } };
    const department = await Department.findByIdAndUpdate(departmentId, update, { new: true }).select(field);
    if (!department) return res.status(404).json({ success: false, message: "Department not found" });

    res.status(200).json({ success: true, [field]: department[field] });
  } catch (error) {
    console.error("Error updating department chat moderation:", error);
    res.status(500).json({ success: false, message: "Failed to update moderation status" });
  }
};

// PUT /admin/department-chat/:departmentId/mute/:userId
exports.muteMember = toggleMembership("mutedMembers", true);
// PUT /admin/department-chat/:departmentId/unmute/:userId
exports.unmuteMember = toggleMembership("mutedMembers", false);
// PUT /admin/department-chat/:departmentId/exclude/:userId
exports.excludeMember = toggleMembership("excludedMembers", true);
// PUT /admin/department-chat/:departmentId/restore/:userId
exports.restoreMember = toggleMembership("excludedMembers", false);
