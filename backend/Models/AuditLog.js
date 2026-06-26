const mongoose = require("mongoose");

// Immutable record of who did what, to what, and when — for any
// grade/status-changing action across the system.
const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    actorRole: {
      type: String,
      enum: ["student", "supervisor", "admin"],
      required: true,
    },
    actorName: {
      type: String,
      default: "",
    },
    action: {
      type: String,
      required: true, // e.g. "PROPOSAL_APPROVED", "GRADE_RELEASED"
    },
    targetType: {
      type: String,
      required: true, // e.g. "Proposal", "Project"
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    details: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
