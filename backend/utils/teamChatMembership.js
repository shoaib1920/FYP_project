const Team = require("../Models/Team");
const Project = require("../Models/Project");

/**
 * Every team automatically has one group chat. Membership = the team's students
 * (members + leader) plus the supervisor of its current project, once one is
 * assigned — mirrors how the 1-to-1 contact lists already derive relationships
 * from Team/Project data instead of maintaining a separate membership list.
 */

// Teams a *student* belongs to (as member or leader).
const getTeamsForStudent = (userId) =>
  Team.find({ $or: [{ members: userId }, { createdBy: userId }] }).lean();

// Teams a *supervisor* is currently supervising (via an assigned project).
const getTeamsForSupervisor = async (userId) => {
  const projects = await Project.find({ supervisorId: userId }).select("teamId").lean();
  const teamIds = [...new Set(projects.map((p) => String(p.teamId)).filter(Boolean))];
  if (teamIds.length === 0) return [];
  return Team.find({ _id: { $in: teamIds } }).lean();
};

// All teams (groups) a given user — student OR supervisor — belongs to.
const getTeamsForUser = async (userId) => {
  const [asStudent, asSupervisor] = await Promise.all([
    getTeamsForStudent(userId),
    getTeamsForSupervisor(userId),
  ]);
  const merged = new Map();
  [...asStudent, ...asSupervisor].forEach((t) => merged.set(String(t._id), t));
  return Array.from(merged.values());
};

// Is this user allowed in this team's group chat?
const isMemberOfTeamChat = async (userId, teamId) => {
  const team = await Team.findById(teamId).lean();
  if (!team) return false;
  const isStudentMember =
    (team.members || []).some((m) => String(m) === String(userId)) ||
    String(team.createdBy) === String(userId);
  if (isStudentMember) return true;

  const project = await Project.findOne({ teamId }).select("supervisorId").lean();
  return !!project && String(project.supervisorId) === String(userId);
};

module.exports = { getTeamsForUser, getTeamsForStudent, getTeamsForSupervisor, isMemberOfTeamChat };
