const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    creatorName: { type: String, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    creatorJoinCode: { type: String, required: true },
    memberNames: [{ type: String }],
     department:{ type: String, required: true },
    // Invited students who haven't accepted/declined yet — see respondToInvite.
    // A student only moves into `members` once they accept. A proposal can't
    // be submitted for this team while any invite here is still unanswered.
    pendingInvites: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        name: { type: String },
        invitedAt: { type: Date, default: Date.now },
      },
    ],
    // Which proposal-deadline reminder thresholds (days-out) have already
    // fired for this team, so the lazy piggy-backed check doesn't re-notify
    // on every page load — same pattern as Project.vivaDetails.remindersSent.
    proposalDeadlineRemindersSent: [{ type: Number }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Team", teamSchema);
