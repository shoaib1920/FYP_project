const PhaseMark = require("../Models/PhaseMark");
const PhaseSchedule = require("../Models/PhaseSchedule");
const Team = require("../Models/Team");
const Project = require("../Models/Project");
const { createNotification } = require("../utils/notify");
const { STAGE_ORDER, STAGE_LABELS, buildStageSummaries, getStageGate } = require("../utils/stageMarks");

const PASS_THRESHOLD_PERCENT = 50;
const SUBMISSION_WINDOW_DAYS_AFTER = 2;

// A staged schedule just completed: hand over to whoever marks next, or —
// if that was the last of the three parts — tell the group its total.
async function notifyStageProgress(schedule, team) {
  const summary = (await buildStageSummaries([team._id])).get(String(team._id));
  if (!summary || summary.stages[schedule.stage].status !== "COMPLETED") return;

  if (summary.total.complete) {
    // The leader is usually both createdBy and a member — notify them once.
    const groupUserIds = [...new Set([team.createdBy, ...team.members].filter(Boolean).map(String))];
    await Promise.all(
      groupUserIds.map((userId) =>
        createNotification({
          userId,
          title: "Final Marks Available",
          message: `All three evaluations for "${team.subject}" are complete — total ${summary.total.obtained} / ${summary.total.max}.`,
          relatedType: "phaseSchedule",
          relatedId: schedule._id,
        })
      )
    );
    return;
  }

  const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(schedule.stage) + 1];
  if (!nextStage) return;
  const nextSchedules = await PhaseSchedule.find({ teamId: team._id, stage: nextStage, status: "SCHEDULED" });
  const recipients = new Set(nextSchedules.flatMap((s) => s.evaluatorIds.map(String)));
  await Promise.all(
    Array.from(recipients).map((userId) =>
      createNotification({
        userId,
        title: `${STAGE_LABELS[nextStage]} Marks Now Open`,
        message: `The ${STAGE_LABELS[schedule.stage].toLowerCase()} evaluation of "${team.subject}" is complete — you can now enter your ${STAGE_LABELS[nextStage].toLowerCase()} marks.`,
        relatedType: "phaseSchedule",
        relatedId: nextSchedules[0]._id,
      })
    )
  );
}

// Once every assigned evaluator has submitted marks for every student in the
// group, average the converted marks into a percentage and finalize
// pass/fail on the schedule. No-op (returns silently) until that's true.
async function checkAndFinalizeResult(schedule) {
  const phase = require("../Models/EvaluationPhase");
  const phaseDoc = await phase.findById(schedule.phaseId);
  const team = await Team.findById(schedule.teamId);
  if (!team) return;

  const studentIds = team.members.map(String);
  const evaluatorIds = schedule.evaluatorIds.map(String);
  if (evaluatorIds.length === 0 || studentIds.length === 0) return;

  const marks = await PhaseMark.find({ phaseScheduleId: schedule._id });
  const submittedPairs = new Set(marks.map((m) => `${m.evaluatorId}_${m.studentId}`));

  for (const evalId of evaluatorIds) {
    for (const sid of studentIds) {
      if (!submittedPairs.has(`${evalId}_${sid}`)) return; // not everyone has submitted yet
    }
  }

  const totalConverted = marks.reduce((sum, m) => sum + m.convertedMarks, 0);
  const maxPossible = (phaseDoc?.convertToMarks || 0) * evaluatorIds.length * studentIds.length;
  const averagePercent = maxPossible > 0 ? Math.round((totalConverted / maxPossible) * 10000) / 100 : 0;
  const result = averagePercent >= PASS_THRESHOLD_PERCENT ? "PASS" : "FAIL";

  const justCompleted = schedule.status !== "COMPLETED";
  schedule.status = "COMPLETED";
  schedule.averageMarks = averagePercent;
  schedule.result = result;
  await schedule.save();

  if (justCompleted && STAGE_ORDER.includes(schedule.stage)) {
    await notifyStageProgress(schedule, team);
  }

  await Promise.all(
    [team.createdBy, ...team.members].filter(Boolean).map((userId) =>
      createNotification({
        userId,
        title: "Evaluation Result",
        message: `Your "${phaseDoc?.name || "phase"}" evaluation is complete — ${result === "PASS" ? "Passed" : "Failed"} (${averagePercent}%).`,
        relatedType: "phaseSchedule",
        relatedId: schedule._id,
      })
    )
  );
}

// POST /faculty/phase-marks — evaluator submits marks for one schedule.
// Body: { phaseScheduleId, marks: [{ studentId, marksObtained }] }
exports.submitMarks = async (req, res) => {
  try {
    const { phaseScheduleId, marks } = req.body;
    if (!phaseScheduleId || !Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ success: false, message: "phaseScheduleId and marks[] are required" });
    }

    const schedule = await PhaseSchedule.findById(phaseScheduleId).populate("phaseId");
    if (!schedule) return res.status(404).json({ success: false, message: "Schedule not found" });

    if (!schedule.evaluatorIds.some((id) => String(id) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: "You are not an evaluator for this schedule" });
    }

    // The three parts are marked in order: internal team, then the group's
    // supervisor, then the external team.
    if (STAGE_ORDER.includes(schedule.stage)) {
      const summary = (await buildStageSummaries([schedule.teamId])).get(String(schedule.teamId));
      const gate = getStageGate(schedule.stage, summary);
      if (gate.locked) return res.status(400).json({ success: false, message: gate.reason });
    }

    const scheduledDate = new Date(schedule.scheduledDate);
    scheduledDate.setHours(0, 0, 0, 0);
    const windowEnd = new Date(scheduledDate);
    windowEnd.setDate(windowEnd.getDate() + SUBMISSION_WINDOW_DAYS_AFTER);
    windowEnd.setHours(23, 59, 59, 999);
    const now = new Date();

    if (now < scheduledDate) {
      return res.status(400).json({
        success: false,
        message: `Marks can't be submitted before the scheduled date (${scheduledDate.toLocaleDateString()}).`,
      });
    }
    if (now > windowEnd) {
      return res.status(400).json({
        success: false,
        message: `The submission window closed on ${windowEnd.toLocaleDateString()}. Contact the admin to reschedule.`,
      });
    }

    const phase = schedule.phaseId;
    const results = [];
    for (const item of marks) {
      const marksObtained = Math.min(Number(item.marksObtained) || 0, phase.totalMarks);
      const convertedMarks = phase.convertMarks(marksObtained);

      const mark = await PhaseMark.findOneAndUpdate(
        { phaseScheduleId, studentId: item.studentId, evaluatorId: req.user._id },
        { maxMarks: phase.totalMarks, marksObtained, convertedMarks, submittedAt: new Date() },
        { upsert: true, new: true }
      );
      results.push(mark);
    }

    await checkAndFinalizeResult(schedule);

    res.status(201).json({ success: true, marks: results });
  } catch (err) {
    console.error("Error submitting marks:", err);
    res.status(500).json({ success: false, message: "Server error while submitting marks" });
  }
};

// GET /admin/phase-marks — admin only, filterable Manage Marks list
exports.getAllMarks = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    let marks = await PhaseMark.find(filter)
      .populate("studentId", "name email department academicSession")
      .populate("evaluatorId", "name email")
      .populate({ path: "phaseScheduleId", populate: { path: "phaseId", select: "name" } })
      .sort({ createdAt: -1 });

    if (req.query.phaseId) {
      marks = marks.filter((m) => String(m.phaseScheduleId?.phaseId?._id) === req.query.phaseId);
    }

    const stats = {
      total: marks.length,
      submitted: marks.filter((m) => m.status === "SUBMITTED").length,
      adjusted: marks.filter((m) => m.status === "ADJUSTED").length,
    };

    res.json({ success: true, marks, stats });
  } catch (err) {
    console.error("Error fetching marks:", err);
    res.status(500).json({ success: false, message: "Server error while fetching marks" });
  }
};

// PUT /admin/phase-marks/:id — admin adjusts a submitted mark
exports.adjustMark = async (req, res) => {
  try {
    const { marksObtained, adjustmentReason } = req.body;
    if (marksObtained === undefined) {
      return res.status(400).json({ success: false, message: "marksObtained is required" });
    }

    const mark = await PhaseMark.findById(req.params.id).populate({
      path: "phaseScheduleId",
      populate: { path: "phaseId" },
    });
    if (!mark) return res.status(404).json({ success: false, message: "Mark not found" });

    const phase = mark.phaseScheduleId.phaseId;
    const obtained = Math.min(Number(marksObtained), mark.maxMarks);
    mark.marksObtained = obtained;
    mark.convertedMarks = phase.convertMarks(obtained);
    mark.status = "ADJUSTED";
    mark.adjustmentReason = adjustmentReason || "";
    mark.adjustedBy = req.user._id;
    mark.adjustedAt = new Date();
    await mark.save();

    await checkAndFinalizeResult(await PhaseSchedule.findById(mark.phaseScheduleId._id));

    res.json({ success: true, mark });
  } catch (err) {
    console.error("Error adjusting mark:", err);
    res.status(500).json({ success: false, message: "Server error while adjusting mark" });
  }
};

// GET /admin/stage-marks — Internal + Supervisor + External breakdown and
// total for every group that has at least one staged evaluation scheduled.
exports.getAllStageMarks = async (req, res) => {
  try {
    const teamIds = await PhaseSchedule.distinct("teamId", { stage: { $in: STAGE_ORDER }, status: { $ne: "CANCELLED" } });
    const summaries = await buildStageSummaries(teamIds);
    const groups = Array.from(summaries.values()).sort((a, b) => a.subject.localeCompare(b.subject));
    res.json({ success: true, groups });
  } catch (err) {
    console.error("Error fetching stage marks:", err);
    res.status(500).json({ success: false, message: "Server error while fetching final marks" });
  }
};

// GET /faculty/supervised-stage-marks — the same breakdown for the groups the
// logged-in supervisor supervises, so they can follow each group through the
// internal evaluation before (and the external one after) giving their own marks.
exports.getSupervisedStageMarks = async (req, res) => {
  try {
    const teamIds = await Project.distinct("teamId", { supervisorId: req.user._id });
    const summaries = await buildStageSummaries(teamIds);
    const groups = Array.from(summaries.values()).sort((a, b) => a.subject.localeCompare(b.subject));
    res.json({ success: true, groups });
  } catch (err) {
    console.error("Error fetching supervised stage marks:", err);
    res.status(500).json({ success: false, message: "Server error while fetching group marks" });
  }
};

// GET /student/stage-marks/:teamId — a student's own group: the group's
// breakdown plus that student's own row (not their teammates').
exports.getTeamStageMarks = async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, message: "Team not found" });

    const isMember = [team.createdBy, ...team.members].some((id) => String(id) === String(req.user._id));
    if (!isMember) return res.status(403).json({ success: false, message: "You are not a member of this group" });

    const summary = (await buildStageSummaries([team._id])).get(String(team._id));
    const mine = summary.students.find((s) => String(s.studentId) === String(req.user._id)) || null;
    res.json({ success: true, summary: { ...summary, students: undefined }, mine });
  } catch (err) {
    console.error("Error fetching team stage marks:", err);
    res.status(500).json({ success: false, message: "Server error while fetching marks" });
  }
};

// GET /phase-results — Pass/Fail results, optionally filtered by ?teamId=
exports.getResults = async (req, res) => {
  try {
    const filter = { status: "COMPLETED" };
    if (req.query.teamId) filter.teamId = req.query.teamId;

    const schedules = await PhaseSchedule.find(filter)
      .populate("phaseId", "name")
      .populate("teamId", "subject memberNames")
      .populate("evaluatorIds", "name")
      .sort({ updatedAt: -1 });

    res.json({ success: true, schedules });
  } catch (err) {
    console.error("Error fetching phase results:", err);
    res.status(500).json({ success: false, message: "Server error while fetching results" });
  }
};
