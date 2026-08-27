const mongoose = require("mongoose");

const meetingLogSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supervisor",
      required: true,
    },

    scheduledAt: {
      type: Date,
      required: true,
    },

    agenda: {
      type: String,
      default: "",
      trim: true,
    },

    minutesOfMeeting: {
      type: String,
      default: "",
      trim: true,
    },

    nextMeetingDate: {
      type: Date,
      default: null,
    },

    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],

    // Per-student Present/Late/Absent, recorded by the supervisor once the
    // meeting has happened — distinct from `attendees` above (kept for
    // backward compat with any existing reads of that plain list).
    attendanceRecords: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        status: { type: String, enum: ["PRESENT", "LATE", "ABSENT"] },
      },
    ],

    status: {
      type: String,
      enum: ["SCHEDULED", "COMPLETED", "CANCELLED"],
      default: "SCHEDULED",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MeetingLog", meetingLogSchema);
