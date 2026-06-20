const mongoose = require("mongoose");

const academicTermSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Fall 2026"
    proposalDeadline: { type: Date, required: true },
    finalSubmissionDeadline: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AcademicTerm", academicTermSchema);
