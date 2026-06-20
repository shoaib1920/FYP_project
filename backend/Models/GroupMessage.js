const mongoose = require("mongoose");

const groupMessageSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Team" },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  // Denormalized (same convention as Team.memberNames) so the frontend never has to
  // populate across two different collections (Users vs Supervisor) just to show a name.
  senderName: { type: String, required: true },
  senderRole: { type: String, enum: ["Student", "Supervisor"], default: "Student" },
  message: { type: String, default: "" },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  fileSize: { type: Number, default: null },
  fileType: { type: String, enum: ["image", "video", "document", null], default: null },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId }],
});

module.exports = mongoose.model("GroupMessage", groupMessageSchema);
