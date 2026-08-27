const mongoose = require("mongoose");

// Supplementary to the existing email-token forgot/reset-password flow
// (PasswordResetController) — for when a user can't access their email and
// needs the admin to manually set/communicate a new password instead.
const passwordResetRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ["student", "supervisor", "admin"], required: true },
    status: { type: String, enum: ["PENDING", "RESOLVED"], default: "PENDING" },
    note: { type: String, default: "" }, // e.g. "New password: xyz123" — set by whoever resolves it
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PasswordResetRequest", passwordResetRequestSchema);
