const mongoose = require("mongoose");

const departmentMessageSchema = new mongoose.Schema({
  departmentId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Department" },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  // Denormalized (same convention as GroupMessage.senderName) so the frontend never
  // has to populate across three different collections (Users/Supervisor/Admin).
  senderName: { type: String, required: true },
  senderRole: { type: String, enum: ["Student", "Supervisor", "Admin"], default: "Student" },
  message: { type: String, default: "" },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  fileSize: { type: Number, default: null },
  fileType: { type: String, enum: ["image", "video", "document", null], default: null },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId }],
});

module.exports = mongoose.model("DepartmentMessage", departmentMessageSchema);
