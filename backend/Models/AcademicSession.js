const mongoose = require("mongoose");

const academicSessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true }, // e.g. "2022-2026"
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AcademicSession", academicSessionSchema);
