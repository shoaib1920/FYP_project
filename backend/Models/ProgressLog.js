const mongoose = require("mongoose");

const progressLogSchema = new mongoose.Schema(
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

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    weekNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    workDone: {
      type: String,
      required: true,
      trim: true,
    },

    plannedNext: {
      type: String,
      default: "",
      trim: true,
    },

    challenges: {
      type: String,
      default: "",
      trim: true,
    },

    supervisorFeedback: {
      type: String,
      default: "",
      trim: true,
    },

    supervisorFeedbackAt: {
      type: Date,
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supervisor",
      default: null,
    },

    status: {
      type: String,
      enum: ["PENDING", "REVIEWED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProgressLog", progressLogSchema);
