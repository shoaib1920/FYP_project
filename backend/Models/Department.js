const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    academicSession: {
      type: String,
      required: true,
      // e.g., "Spring 2026", "Fall 2026"
    },
    description: {
      type: String,
      trim: true,
    },
    studentJoinCode: {
      type: String,
      required: true,
      unique: true,
      // Format: CS-STU-4WKL
    },
    supervisorJoinCode: {
      type: String,
      required: true,
      unique: true,
      // Format: CS-SUP-8JQ2
    },
    totalStudents: {
      type: Number,
      default: 0,
    },
    totalSupervisors: {
      type: Number,
      default: 0,
    },
    totalTeams: {
      type: Number,
      default: 0,
    },
    totalProjects: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", DepartmentSchema);
