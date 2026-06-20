const mongoose = require("mongoose");

const proposalSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
   teamLeaderId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "users"
},
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "",
    },
    academicSession: {
      type: String,
      default: "",
    },
    abstract: {
      type: String,
      required: true,
    },
    objectives: {
      type: String,
      required: true,
    },
    technologies: {
      type: String,
      required: true,
    },

    preferredSupervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supervisor",
      default: null,
    },

    assignedSupervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supervisor",
      default: null,
    },

    proposalReportUrl: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "PENDING_ADMIN_REVIEW",
        "APPROVED_BY_ADMIN",
        "SUPERVISOR_ASSIGNED",
        "SUPERVISOR_ACCEPTED",
        "REVISION_REQUESTED_BY_ADMIN",
        "REVISION_REQUESTED_BY_SUPERVISOR",
        "REJECTED",
      ],
      default: "PENDING_ADMIN_REVIEW",
    },

    adminRemarks: {
      type: String,
      default: "",
    },

    supervisorRemarks: {
      type: String,
      default: "",
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    approvedAt: Date,
    supervisorAcceptedAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Proposal", proposalSchema);