const PhaseMark = require("../Models/PhaseMark");
const PhaseSchedule = require("../Models/PhaseSchedule");
const Team = require("../Models/Team");
const { createNotification } = require("../utils/notify");

const PASS_THRESHOLD_PERCENT = 50;
const SUBMISSION_WINDOW_DAYS_AFTER = 2;

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

  schedule.status = "COMPLETED";
  schedule.averageMarks = averagePercent;
  schedule.result = result;
  await schedule.save();

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
