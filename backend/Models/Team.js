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
    // Structured facets matching the reference system's Department × Session
    // × Shift model — optional/nullable so existing teams (created before
    // this existed) aren't affected. groupCode is auto-generated at creation
    // time only when department/session/shift are all known (see
    // TeamController.generateGroupCode); left null otherwise.
    academicSession: { type: String, default: "" },
    shift: { type: String, enum: ["Morning", "Evening", null], default: null },
    groupCode: { type: String, default: null },
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
