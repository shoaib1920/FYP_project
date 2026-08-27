const mongoose = require("mongoose");

// One evaluator's marks for one student, for one phase schedule. Multiple
// evaluators can each submit their own row for the same student — the
// schedule's final average/result is computed once every assigned evaluator
// has submitted for every student in the group (see PhaseMarkController).
const phaseMarkSchema = new mongoose.Schema(
  {
    phaseScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "PhaseSchedule", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    evaluatorId: { type: mongoose.Schema.Types.ObjectId, ref: "Supervisor", required: true },
    maxMarks: { type: Number, required: true },
    marksObtained: { type: Number, required: true, min: 0 },
    convertedMarks: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["SUBMITTED", "ADJUSTED"], default: "SUBMITTED" },
    adjustmentReason: { type: String, default: "" },
    adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    adjustedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One mark per (schedule, student, evaluator) — resubmitting overwrites, matching
// StudentPhaseMark::updateOrCreate's key in the reference implementation.
phaseMarkSchema.index({ phaseScheduleId: 1, studentId: 1, evaluatorId: 1 }, { unique: true });

module.exports = mongoose.model("PhaseMark", phaseMarkSchema);
