const PhaseSchedule = require("../Models/PhaseSchedule");
const EvaluationPhase = require("../Models/EvaluationPhase");
const EvaluationPanel = require("../Models/EvaluationPanel");
const Project = require("../Models/Project");
const Proposal = require("../Models/Proposal");
const Team = require("../Models/Team");
const { createNotification } = require("../utils/notify");

// A phase's evaluators are the phase's panel members plus the team's current
// supervisor (if one is already assigned) — mirrors how the reference system
// links panel + supervisor as evaluators at schedule time.
async function resolveEvaluatorIds(phase, teamId) {
  const ids = new Set();

  if (phase.panelId) {
    const panel = await EvaluationPanel.findById(phase.panelId);
    if (panel) panel.members.forEach((m) => ids.add(String(m)));
  }

  const project = await Project.findOne({ teamId });
  if (project && project.supervisorId) {
    ids.add(String(project.supervisorId));
  } else {
    const proposal = await Proposal.findOne({ teamId }).sort({ createdAt: -1 });
    if (proposal && proposal.assignedSupervisorId) {
      ids.add(String(proposal.assignedSupervisorId));
    }
  }

  return Array.from(ids);
}

async function notifyTeam(teamId, title, message) {
  const team = await Team.findById(teamId);
  if (!team) return;
  const recipients = [team.createdBy, ...team.members].filter(Boolean);
  await Promise.all(
    recipients.map((userId) =>
      createNotification({ userId, title, message, relatedType: "phaseSchedule", relatedId: teamId })
    )
  );
}

// POST /admin/phase-schedules — admin only. Body: { phaseId, teamIds: [...], scheduledDate, scheduledTime, room }
// Accepts a single teamId or an array, so the same endpoint powers both the
// single-assign and bulk-assign forms.
exports.createSchedule = async (req, res) => {
  try {
    const { phaseId, teamId, teamIds, scheduledDate, scheduledTime, room } = req.body;
    const targetTeamIds = teamIds && teamIds.length ? teamIds : teamId ? [teamId] : [];

    if (!phaseId || targetTeamIds.length === 0 || !scheduledDate) {
      return res.status(400).json({
        success: false,
        message: "phaseId, at least one team, and scheduledDate are required",
      });
    }

    const phase = await EvaluationPhase.findById(phaseId);
    if (!phase) return res.status(404).json({ success: false, message: "Phase not found" });

    const created = [];
    for (const tId of targetTeamIds) {
      const evaluatorIds = await resolveEvaluatorIds(phase, tId);
      const schedule = await PhaseSchedule.create({
        phaseId,
        teamId: tId,
        panelId: phase.panelId || null,
        evaluatorIds,
        scheduledDate: new Date(scheduledDate),
        scheduledTime: scheduledTime || "",
        room: room || "",
        createdBy: req.user._id,
      });
      created.push(schedule);
      await notifyTeam(
        tId,
        "Evaluation Scheduled",
        `"${phase.name}" has been scheduled for your group on ${new Date(scheduledDate).toLocaleDateString()}.`
      );
    }

    res.status(201).json({ success: true, schedules: created });
  } catch (err) {
    console.error("Error creating phase schedule:", err);
    res.status(500).json({ success: false, message: "Server error while creating schedule" });
  }
};

// GET /admin/phase-schedules — admin only, with optional ?phaseId=&teamId=&status=
exports.getAllSchedules = async (req, res) => {
  try {
    const filter = {};
    if (req.query.phaseId) filter.phaseId = req.query.phaseId;
    if (req.query.teamId) filter.teamId = req.query.teamId;
    if (req.query.status) filter.status = req.query.status;

    const schedules = await PhaseSchedule.find(filter)
      .populate("phaseId")
      .populate("teamId", "subject department memberNames")
      .populate("evaluatorIds", "name email")
      .sort({ scheduledDate: -1 });

    res.json({ success: true, schedules });
  } catch (err) {
    console.error("Error fetching phase schedules:", err);
    res.status(500).json({ success: false, message: "Server error while fetching schedules" });
  }
};

// GET /faculty/phase-schedules — schedules where the logged-in supervisor is an evaluator
exports.getMySchedulesAsEvaluator = async (req, res) => {
  try {
    const schedules = await PhaseSchedule.find({ evaluatorIds: req.user._id })
      .populate("phaseId")
      .populate({ path: "teamId", select: "subject department members", populate: { path: "members", select: "name email" } })
      .sort({ scheduledDate: -1 });

    res.json({ success: true, schedules });
  } catch (err) {
    console.error("Error fetching evaluator schedules:", err);
    res.status(500).json({ success: false, message: "Server error while fetching schedules" });
  }
};

// GET /student/phase-schedules/:teamId — a team's own schedule + result history
exports.getTeamSchedules = async (req, res) => {
  try {
    const schedules = await PhaseSchedule.find({ teamId: req.params.teamId })
      .populate("phaseId")
      .sort({ scheduledDate: 1 });

    res.json({ success: true, schedules });
  } catch (err) {
    console.error("Error fetching team schedules:", err);
    res.status(500).json({ success: false, message: "Server error while fetching schedules" });
  }
};

// PUT /admin/phase-schedules/:id — admin only (edit date/time/room)
exports.updateSchedule = async (req, res) => {
  try {
    const schedule = await PhaseSchedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: "Schedule not found" });

    const { scheduledDate, scheduledTime, room, status } = req.body;
    if (scheduledDate !== undefined) schedule.scheduledDate = new Date(scheduledDate);
    if (scheduledTime !== undefined) schedule.scheduledTime = scheduledTime;
    if (room !== undefined) schedule.room = room;
    if (status !== undefined) schedule.status = status;
    await schedule.save();

    res.json({ success: true, schedule });
  } catch (err) {
    console.error("Error updating phase schedule:", err);
    res.status(500).json({ success: false, message: "Server error while updating schedule" });
  }
};

// DELETE /admin/phase-schedules/:id — admin only
exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await PhaseSchedule.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: "Schedule not found" });
    res.json({ success: true, message: "Schedule deleted" });
  } catch (err) {
    console.error("Error deleting phase schedule:", err);
    res.status(500).json({ success: false, message: "Server error while deleting schedule" });
  }
};

// POST /admin/phase-schedules/:id/retry — admin only, only after a FAIL result.
// Creates a fresh schedule (new attempt) re-using the same evaluators.
exports.retrySchedule = async (req, res) => {
  try {
    const { scheduledDate, scheduledTime, room } = req.body;
    const schedule = await PhaseSchedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: "Schedule not found" });
    if (schedule.result !== "FAIL") {
      return res.status(400).json({ success: false, message: "Retry is only allowed after a failing result" });
    }
    if (!scheduledDate) {
      return res.status(400).json({ success: false, message: "scheduledDate is required" });
    }

    const retry = await PhaseSchedule.create({
      phaseId: schedule.phaseId,
      teamId: schedule.teamId,
      panelId: schedule.panelId,
      evaluatorIds: schedule.evaluatorIds,
      scheduledDate: new Date(scheduledDate),
      scheduledTime: scheduledTime || "",
      room: room || "",
      attemptNumber: schedule.attemptNumber + 1,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, schedule: retry });
  } catch (err) {
    console.error("Error scheduling retry:", err);
    res.status(500).json({ success: false, message: "Server error while scheduling retry" });
  }
};

exports.resolveEvaluatorIds = resolveEvaluatorIds;
