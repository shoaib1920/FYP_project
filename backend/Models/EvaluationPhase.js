const mongoose = require("mongoose");

// Admin-defined phase *template* — e.g. "Proposal Defence", "SRS", "Final Defence".
// Distinct from the fixed INTERNAL/MIDTERM/FINAL subdocs on Project.evaluationPhases,
// which stay untouched for projects already graded under the old flow. This is the
// flexible, schedulable phase system: create a phase once, then schedule it against
// any number of groups (see PhaseSchedule).
const evaluationPhaseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    totalMarks: { type: Number, required: true, min: 0 },
    convertToMarks: { type: Number, required: true, min: 0 },
    criteria: [
      {
        name: { type: String, required: true },
        maxMarks: { type: Number, required: true, min: 0 },
      },
    ],
    panelId: { type: mongoose.Schema.Types.ObjectId, ref: "EvaluationPanel", default: null },
    requiresUpload: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

// Same conversion formula Luna uses: obtained/total * convertTo, rounded to 2dp.
evaluationPhaseSchema.methods.convertMarks = function (obtained) {
  if (!this.totalMarks) return 0;
  return Math.round(((obtained * this.convertToMarks) / this.totalMarks) * 100) / 100;
};

module.exports = mongoose.model("EvaluationPhase", evaluationPhaseSchema);
