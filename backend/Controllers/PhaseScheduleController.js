const PhaseSchedule = require("../Models/PhaseSchedule");
const EvaluationPhase = require("../Models/EvaluationPhase");
const EvaluationPanel = require("../Models/EvaluationPanel");
const Project = require("../Models/Project");
const Proposal = require("../Models/Proposal");
const Team = require("../Models/Team");
const Users = require("../Models/Users");
const AssignedProject = require("../Models/SupervisorModels/AssignedProject");
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

    // Re-resolve evaluators fresh (current panel membership + current
    // supervisor) rather than reusing the original schedule's snapshot —
    // matches the reference system's retry behavior: if the panel or
    // supervisor changed since the first attempt, the retry should reflect
    // that, not silently re-use whoever was assigned at the original attempt.
    const phase = await EvaluationPhase.findById(schedule.phaseId);
    const evaluatorIds = await resolveEvaluatorIds(phase, schedule.teamId);

    const retry = await PhaseSchedule.create({
      phaseId: schedule.phaseId,
      teamId: schedule.teamId,
      panelId: schedule.panelId,
      evaluatorIds,
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

// POST /admin/phase-schedules/:id/assign-supervisor — admin only.
// Mirrors the reference system: passing a phase (e.g. a "Proposal Defence"
// phase) unlocks a direct supervisor assignment action, separate from and
// additional to the existing proposal-review assign/accept flow. This never
// touches or gates that existing flow — a team can still get a supervisor
// the old way (admin assigns on the proposal, supervisor accepts). This is
// just a second path that becomes available once a phase has passed,
// matching how the reference system does it. Assignment here is immediate
// (no separate supervisor-acceptance step), same as the reference system.
exports.assignSupervisorFromSchedule = async (req, res) => {
  try {
    const { supervisorId } = req.body;
    if (!supervisorId) {
      return res.status(400).json({ success: false, message: "supervisorId is required" });
    }

    const schedule = await PhaseSchedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: "Schedule not found" });
    if (schedule.result !== "PASS") {
      return res.status(400).json({ success: false, message: "Supervisor can only be assigned after a passing result" });
    }

    const team = await Team.findById(schedule.teamId);
    if (!team) return res.status(404).json({ success: false, message: "Team not found" });

    const proposal = await Proposal.findOne({ teamId: team._id }).sort({ createdAt: -1 });
    if (!proposal) {
      return res.status(400).json({ success: false, message: "This team has no proposal on record yet — cannot create a project without one" });
    }

    proposal.assignedSupervisorId = supervisorId;
    proposal.status = "SUPERVISOR_ACCEPTED";
    proposal.supervisorAcceptedAt = new Date();
    await proposal.save();

    let project = await Project.findOne({ proposalId: proposal._id });
    if (!project) {
      let departmentId = proposal.departmentId;
      if (!departmentId) {
        const leader = await Users.findById(team.createdBy);
        departmentId = leader?.department || null;
      }

      project = await Project.create({
        proposalId: proposal._id,
        teamId: team._id,
        teamLeaderId: team.createdBy,
        departmentId,
        supervisorId,
        title: proposal.title,
        category: proposal.category,
        abstract: proposal.abstract,
        objectives: proposal.objectives,
        technologies: proposal.technologies,
        academicSession: proposal.academicSession,
        proposalReportUrl: proposal.proposalReportUrl,
        status: "ACTIVE",
        progress: 0,
        startDate: new Date(),
      });

      await AssignedProject.create({
        projectId: project._id,
        proposalId: proposal._id,
        teamId: team._id,
        teamLeaderId: team.createdBy,
        supervisorId,
        departmentId: departmentId || null,
        assignedAt: new Date(),
        status: "ACTIVE",
      });
    } else {
      project.supervisorId = supervisorId;
      await project.save();
    }

    await Promise.all(
      [team.createdBy, ...team.members, supervisorId].filter(Boolean).map((userId) =>
        createNotification({
          userId,
          title: "Supervisor Assigned",
          message: `A supervisor has been assigned to "${team.subject}" following a passed evaluation.`,
          relatedType: "project",
          relatedId: project._id,
        })
      )
    );

    res.json({ success: true, project });
  } catch (err) {
    console.error("Error assigning supervisor from schedule:", err);
    res.status(500).json({ success: false, message: "Server error while assigning supervisor" });
  }
};

exports.resolveEvaluatorIds = resolveEvaluatorIds;
