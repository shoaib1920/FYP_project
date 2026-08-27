const mongoose = require("mongoose");

const phaseDocumentSchema = new mongoose.Schema(
  {
    phaseId: { type: mongoose.Schema.Types.ObjectId, ref: "EvaluationPhase", required: true },
    phaseScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "PhaseSchedule", required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PhaseDocument", phaseDocumentSchema);
