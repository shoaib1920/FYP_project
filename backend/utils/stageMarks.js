const PhaseSchedule = require("../Models/PhaseSchedule");
const PhaseMark = require("../Models/PhaseMark");
const Team = require("../Models/Team");
const Project = require("../Models/Project");
const Proposal = require("../Models/Proposal");

// A group's final marks are made of three parts, marked strictly in this
// order: the internal team first, then the group's supervisor, then the
// external team. Each part is one or more EvaluationPhases tagged with that
// stage; the part's weight is simply the phase's convertToMarks.
const STAGE_ORDER = ["INTERNAL", "SUPERVISOR", "EXTERNAL"];
const STAGE_LABELS = { INTERNAL: "Internal", SUPERVISOR: "Supervisor", EXTERNAL: "External" };

const round2 = (n) => Math.round(n * 100) / 100;

// The team's current supervisor: the project's if one exists, otherwise the
// one assigned on its latest proposal.
async function getTeamSupervisorId(teamId) {
  const project = await Project.findOne({ teamId });
  if (project && project.supervisorId) return String(project.supervisorId);
  const proposal = await Proposal.findOne({ teamId }).sort({ createdAt: -1 });
  if (proposal && proposal.assignedSupervisorId) return String(proposal.assignedSupervisorId);
  return null;
}

// Only the latest attempt of each phase counts — a retry after a FAIL
// replaces the earlier attempt's marks rather than adding to them.
function latestAttemptPerPhase(schedules) {
  const latest = new Map();
  for (const s of schedules) {
    const key = String(s.phaseId?._id || s.phaseId);
    const current = latest.get(key);
    if (!current || s.attemptNumber > current.attemptNumber) latest.set(key, s);
  }
  return Array.from(latest.values());
}

function emptyStage() {
  return { status: "NOT_SCHEDULED", obtained: null, max: 0, phases: [] };
}

// Builds the Internal / Supervisor / External breakdown and running total for
// each of the given teams. Returns a Map keyed by teamId string.
async function buildStageSummaries(teamIds) {
  const ids = teamIds.map(String);
  const [teams, schedules] = await Promise.all([
    Team.find({ _id: { $in: ids } }).populate("members", "name studentId"),
    PhaseSchedule.find({ teamId: { $in: ids }, stage: { $in: STAGE_ORDER }, status: { $ne: "CANCELLED" } })
      .populate("phaseId", "name totalMarks convertToMarks")
      .sort({ scheduledDate: 1 }),
  ]);
  const marks = await PhaseMark.find({ phaseScheduleId: { $in: schedules.map((s) => s._id) } });

  const marksBySchedule = new Map();
  for (const m of marks) {
    const key = String(m.phaseScheduleId);
    if (!marksBySchedule.has(key)) marksBySchedule.set(key, []);
    marksBySchedule.get(key).push(m);
  }

  const summaries = new Map();
  for (const team of teams) {
    const teamSchedules = schedules.filter((s) => String(s.teamId) === String(team._id));
    const stages = {};
    const studentTotals = new Map(
      team.members.map((m) => [String(m._id), { studentId: m._id, name: m.name, rollNo: m.studentId, INTERNAL: null, SUPERVISOR: null, EXTERNAL: null, total: 0 }])
    );

    for (const stage of STAGE_ORDER) {
      const stageInfo = emptyStage();
      const counted = latestAttemptPerPhase(teamSchedules.filter((s) => s.stage === stage && s.phaseId));

      for (const s of counted) {
        const max = s.phaseId.convertToMarks || 0;
        const completed = s.status === "COMPLETED";
        let obtained = null;

        if (completed) {
          // Each student's score for this phase is the average of what the
          // evaluators gave them; the group's score is the average of its students.
          const perStudent = new Map();
          for (const m of marksBySchedule.get(String(s._id)) || []) {
            const key = String(m.studentId);
            if (!perStudent.has(key)) perStudent.set(key, []);
            perStudent.get(key).push(m.convertedMarks);
          }
          const studentScores = [];
          for (const [sid, values] of perStudent) {
            const score = values.reduce((a, b) => a + b, 0) / values.length;
            studentScores.push(score);
            const row = studentTotals.get(sid);
            if (row) row[stage] = round2((row[stage] || 0) + score);
          }
          obtained = studentScores.length ? round2(studentScores.reduce((a, b) => a + b, 0) / studentScores.length) : 0;
        }

        stageInfo.max = round2(stageInfo.max + max);
        if (obtained !== null) stageInfo.obtained = round2((stageInfo.obtained || 0) + obtained);
        stageInfo.phases.push({
          scheduleId: s._id,
          phaseName: s.phaseId.name,
          status: s.status,
          scheduledDate: s.scheduledDate,
          attemptNumber: s.attemptNumber,
          obtained,
          max,
        });
      }

      if (counted.length > 0) {
        stageInfo.status = counted.every((s) => s.status === "COMPLETED") ? "COMPLETED" : "PENDING";
      }
      stages[stage] = stageInfo;
    }

    const students = Array.from(studentTotals.values()).map((row) => ({
      ...row,
      total: round2(STAGE_ORDER.reduce((sum, st) => sum + (row[st] || 0), 0)),
    }));

    summaries.set(String(team._id), {
      teamId: team._id,
      subject: team.subject,
      groupCode: team.groupCode,
      department: team.department,
      shift: team.shift,
      stages,
      total: {
        obtained: round2(STAGE_ORDER.reduce((sum, st) => sum + (stages[st].obtained || 0), 0)),
        max: round2(STAGE_ORDER.reduce((sum, st) => sum + stages[st].max, 0)),
        complete: STAGE_ORDER.every((st) => stages[st].status === "COMPLETED"),
      },
      students,
    });
  }

  return summaries;
}

// Keeps who-has-finished visible but strips the actual marks — used for
// evaluators who aren't the group's supervisor, so one team's marks don't
// influence the next team's.
function redactScores(summary) {
  const stages = {};
  for (const stage of STAGE_ORDER) {
    const s = summary.stages[stage];
    stages[stage] = { ...s, obtained: null, phases: s.phases.map((p) => ({ ...p, obtained: null })) };
  }
  return { ...summary, stages, total: { ...summary.total, obtained: null }, students: [] };
}

// Whether marks for a schedule of the given stage may be entered yet, given
// the team's summary. INTERNAL and GENERAL are never locked.
function getStageGate(stage, summary) {
  const index = STAGE_ORDER.indexOf(stage);
  if (index <= 0 || !summary) return { locked: false, reason: "" };

  const previous = STAGE_ORDER[index - 1];
  if (summary.stages[previous].status === "COMPLETED") return { locked: false, reason: "" };

  const reason =
    stage === "SUPERVISOR"
      ? "Supervisor marks open once the internal team has finished marking this group."
      : "External marks open once the internal team and then the supervisor have finished marking this group.";
  return { locked: true, reason };
}

module.exports = {
  STAGE_ORDER,
  STAGE_LABELS,
  getTeamSupervisorId,
  buildStageSummaries,
  redactScores,
  getStageGate,
};
