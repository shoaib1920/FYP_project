const mongoose = require("mongoose");

// One phase, assigned to one team, for one attempt. A failing result can be
// retried by creating a new PhaseSchedule with attemptNumber + 1 (see
// PhaseScheduleController.retry) — history of prior attempts is preserved
// rather than overwritten.
const phaseScheduleSchema = new mongoose.Schema(
  {
    phaseId: { type: mongoose.Schema.Types.ObjectId, ref: "EvaluationPhase", required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    panelId: { type: mongoose.Schema.Types.ObjectId, ref: "EvaluationPanel", default: null },
    // Evaluators for this specific schedule — panel members snapshotted at
    // schedule time, plus the team's supervisor if any. Kept as its own list
    // (rather than re-deriving from panel.members every time) so marks
    // submission windows and per-schedule "who still needs to submit" checks
    // are stable even if the panel's membership changes later.
    evaluatorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Supervisor" }],
    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, default: "" }, // stored as "HH:mm", kept simple like the rest of this app's time fields
    room: { type: String, default: "" },
    status: { type: String, enum: ["SCHEDULED", "COMPLETED", "CANCELLED"], default: "SCHEDULED" },
    attemptNumber: { type: Number, default: 1 },
    result: { type: String, enum: ["PENDING", "PASS", "FAIL"], default: "PENDING" },
    resultRemarks: { type: String, default: "" },
    averageMarks: { type: Number, default: null }, // average % across evaluators/students, set once completed
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PhaseSchedule", phaseScheduleSchema);
