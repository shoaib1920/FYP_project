const mongoose = require("mongoose");

const TaskAssignmentSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    taskCode: {
      type: String,
    },
    taskFile: {
      type: String,
    },
    studentJoinCode: {
      type: String,
    },
    assignerJoinCode: {
      type: String,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    description: {
      type: String,
    },
    user: {
      type: String, // Student name or display label
      required: true,
    },
    user_id: {
      type: String, // Student user ID
      required: true,
    },
    role: {
      type: String,
      enum: ["Developer", "Moderator", "Admin", "Tester", "Designer"],
      required: true,
    },
    assignedBy: {
      type: String, // User ID of assigner
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Approved", "Rejected"],
      default: "Pending",
    },
    assignedAt: { type: Date, default: Date.now },
    submissionNote: {
      type: String,
    },
    submissionFile: {
      type: String,
    },
    submittedAt: {
      type: Date,
    },
    reviewNote: {
      type: String,
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TaskAssignment", TaskAssignmentSchema);
