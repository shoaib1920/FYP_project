const Team = require("../Models/Team");
const Proposal = require("../Models/Proposal");
const Project = require("../Models/Project");
const PhaseSchedule = require("../Models/PhaseSchedule");
const PhaseMark = require("../Models/PhaseMark");
const MeetingLog = require("../Models/MeetingLog");

// GET /admin/group-tracking — one summary row per team
exports.getAllGroupsSummary = async (req, res) => {
  try {
    const teams = await Team.find().populate("members", "name email").sort({ createdAt: -1 });

    const summary = await Promise.all(
      teams.map(async (team) => {
        const project = await Project.findOne({ teamId: team._id }).populate("supervisorId", "name");
        return {
          teamId: team._id,
          subject: team.subject,
          department: team.department,
          members: team.members.length,
          supervisor: project?.supervisorId?.name || "Not assigned",
          status: project ? project.status : "Open",
        };
      })
    );

    res.json({ success: true, groups: summary });
  } catch (err) {
    console.error("Error fetching group tracking summary:", err);
    res.status(500).json({ success: false, message: "Server error while fetching groups" });
  }
};

// GET /admin/group-tracking/:teamId — full FYP history for one group
exports.getGroupHistory = async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await Team.findById(teamId).populate("members", "name email");
    if (!team) return res.status(404).json({ success: false, message: "Team not found" });

    const proposal = await Proposal.findOne({ teamId }).sort({ createdAt: -1 });
    const project = await Project.findOne({ teamId }).populate("supervisorId", "name email");
    const schedules = await PhaseSchedule.find({ teamId }).populate("phaseId", "name totalMarks").sort({ scheduledDate: 1 });
    const marks = await PhaseMark.find({ phaseScheduleId: { $in: schedules.map((s) => s._id) } }).populate("evaluatorId", "name");
    const meetings = await MeetingLog.find({ teamId }).sort({ scheduledAt: 1 });

    const schedulesWithMarks = schedules.map((s) => ({
      ...s.toObject(),
      marks: marks.filter((m) => String(m.phaseScheduleId) === String(s._id)),
    }));

    res.json({
      success: true,
      team,
      proposal,
      project,
      phaseHistory: schedulesWithMarks,
      meetings,
    });
  } catch (err) {
    console.error("Error fetching group history:", err);
    res.status(500).json({ success: false, message: "Server error while fetching group history" });
  }
};
