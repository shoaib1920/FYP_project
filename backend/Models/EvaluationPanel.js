const mongoose = require("mongoose");

const evaluationPanelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    // INTERNAL = the department's own evaluation team, EXTERNAL = the external
    // examiners. An INTERNAL/EXTERNAL-stage phase can only use a panel of the
    // matching type. External examiners are given ordinary faculty accounts.
    type: { type: String, enum: ["INTERNAL", "EXTERNAL"], default: "INTERNAL" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Supervisor" }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EvaluationPanel", evaluationPanelSchema);
