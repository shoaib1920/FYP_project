const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // GLOBAL = visible to every student; PROJECT = visible to one team only
    scope: {
      type: String,
      enum: ["GLOBAL", "PROJECT"],
      required: true,
    },

    category: {
      type: String,
      enum: ["Proposal", "Progress Report", "Final Report", "Defense", "General"],
      required: true,
    },

    uploadedBy:     { type: mongoose.Schema.Types.ObjectId, required: true },
    uploadedByRole: { type: String, enum: ["admin", "supervisor"], required: true },
    uploadedByName: { type: String, default: "" },

    // Only populated when scope === "PROJECT"
    fypProjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    teamId:       { type: mongoose.Schema.Types.ObjectId, ref: "Team",    default: null },

    fileName:     { type: String, required: true },
    originalName: { type: String, required: true },
    fileType:     { type: String, required: true },
    fileUrl:      { type: String, required: true },
  },
  { timestamps: true }
);

templateSchema.methods.toPublic = function () {
  const obj = this.toObject({ versionKey: false });
  return obj;
};

module.exports = mongoose.model("Template", templateSchema);
