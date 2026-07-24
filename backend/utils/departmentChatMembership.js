const Users = require("../Models/Users");
const Supervisor = require("../Models/supervisorModel");
const Admin = require("../Models/Admin/AdminAuth");
const Department = require("../Models/Department");

/**
 * Every department automatically has one all-hands group chat — students and
 * supervisors belong to it via their own `department` field; admins aren't
 * scoped to a single department in this system (they oversee departments
 * broadly), so an admin belongs to ALL department chats, matching their
 * existing department-management scope.
 */

// The single department a student or supervisor belongs to, or null (also
// null for an admin — see getDepartmentIdsForUser for the admin case).
const getUserOwnDepartmentId = async (userId) => {
  const student = await Users.findById(userId).select("department").lean();
  if (student) return student.department ? String(student.department) : null;

  const supervisor = await Supervisor.findById(userId).select("department").lean();
  if (supervisor) return supervisor.department ? String(supervisor.department) : null;

  return null; // not a student/supervisor — likely an admin
};

const isAdminUser = async (userId) => !!(await Admin.findById(userId).select("_id").lean());

// Every department-chat room id this user should auto-join at socket connect.
const getDepartmentIdsForUser = async (userId) => {
  const ownDeptId = await getUserOwnDepartmentId(userId);
  if (ownDeptId) return [ownDeptId];

  if (await isAdminUser(userId)) {
    const departments = await Department.find().select("_id").lean();
    return departments.map((d) => String(d._id));
  }

  return [];
};

// Is this user even allowed in this department's chat at all (member + not excluded)?
const canAccessDepartmentChat = async (userId, departmentId) => {
  const department = await Department.findById(departmentId).select("excludedMembers").lean();
  if (!department) return false;
  const excluded = (department.excludedMembers || []).some((id) => String(id) === String(userId));
  if (excluded) return false;

  const ownDeptId = await getUserOwnDepartmentId(userId);
  if (ownDeptId && ownDeptId === String(departmentId)) return true;
  return isAdminUser(userId);
};

// Can this user currently POST in this department's chat (member + not excluded + not muted)?
const canPostInDepartmentChat = async (userId, departmentId) => {
  const allowed = await canAccessDepartmentChat(userId, departmentId);
  if (!allowed) return false;
  const department = await Department.findById(departmentId).select("mutedMembers").lean();
  const muted = (department?.mutedMembers || []).some((id) => String(id) === String(userId));
  return !muted;
};

module.exports = {
  getUserOwnDepartmentId,
  isAdminUser,
  getDepartmentIdsForUser,
  canAccessDepartmentChat,
  canPostInDepartmentChat,
};
