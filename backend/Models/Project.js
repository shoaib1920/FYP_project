const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    // Reference to original proposal
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      unique: true,
    },

    // Team Information
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    teamLeaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },

    // Supervisor
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supervisor",
      required: true,
    },

    // Project Details
    title: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      default: "",
    },

    abstract: {
      type: String,
      default: "",
    },

    objectives: {
      type: String,
      default: "",
    },

    technologies: {
      type: String,
      default: "",
    },

    academicSession: {
      type: String,
      default: "",
    },

    proposalReportUrl: {
      type: String,
      default: "",
    },

    // Project Progress
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Project Status
    status: {
      type: String,
      enum: [
        "ACTIVE",
        "IN_PROGRESS",
        "ON_HOLD",
        "UNDER_REVIEW",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "ACTIVE",
    },

    // Optional Information
    githubRepository: {
      type: String,
      default: "",
    },

    deploymentLink: {
      type: String,
      default: "",
    },

    finalReportUrl: {
      type: String,
      default: "",
    },

    evaluationMarks: {
      type: Number,
      default: 0,
    },

    memberGrades: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        name: { type: String },
        marks: { type: Number, min: 0, max: 100, default: 0 },
      },
    ],

    // Grade approval flow
    gradesStatus: {
      type: String,
      enum: ["PENDING_RELEASE", "RELEASED", "FLAGGED"],
      default: "PENDING_RELEASE",
    },

    adminRemarks: { type: String, default: "" },
    flaggedReason: { type: String, default: "" },

    remarks: {
      type: String,
      default: "",
    },

    // Dates
    startDate: {
      type: Date,
      default: Date.now,
    },

    completionDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Project || mongoose.model("Project", projectSchema);