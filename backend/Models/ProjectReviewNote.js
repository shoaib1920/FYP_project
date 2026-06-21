const mongoose = require("mongoose");

const annotationSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true }, // % from left, 0-100
    y: { type: Number, required: true }, // % from top, 0-100
    text: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const reviewItemSchema = new mongoose.Schema(
  {
    screenshotUrl: { type: String, required: true },
    annotations: [annotationSchema],
  },
  { _id: false }
);

// One ProjectReviewNote = one review session: the supervisor browses the
// live project, snips multiple screenshots and marks issues on each, then
// sends the whole batch + one overall remark to the team in one go.
const projectReviewNoteSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supervisor",
      required: true,
    },
    items: {
      type: [reviewItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "A review session needs at least one screenshot",
      },
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "RESOLVED"],
      default: "OPEN",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProjectReviewNote", projectReviewNoteSchema);
