const PasswordResetRequest = require("../Models/PasswordResetRequest");
const Users = require("../Models/Users");
const Supervisor = require("../Models/supervisorModel");
const bcrypt = require("bcryptjs");

// POST /password-reset-requests — public. Supplementary to the email-token
// forgot-password flow, for when a user can't access their email.
exports.createRequest = async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) {
      return res.status(400).json({ success: false, message: "email and role are required" });
    }

    const Model = role === "supervisor" ? Supervisor : Users;
    const user = await Model.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with this email address" });
    }

    const existing = await PasswordResetRequest.findOne({ email, status: "PENDING" });
    if (existing) {
      return res.json({ success: true, message: "A reset request is already pending for this account." });
    }

    await PasswordResetRequest.create({ name: user.name, email, role });
    res.status(201).json({ success: true, message: "Your request has been sent to the admin." });
  } catch (err) {
    console.error("Error creating password reset request:", err);
    res.status(500).json({ success: false, message: "Server error while creating request" });
  }
};

// GET /admin/password-reset-requests — admin only
exports.getAllRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const requests = await PasswordResetRequest.find(filter)
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    console.error("Error fetching password reset requests:", err);
    res.status(500).json({ success: false, message: "Server error while fetching requests" });
  }
};

// PUT /admin/password-reset-requests/:id/resolve — admin sets a new password directly
exports.resolveRequest = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "newPassword must be at least 6 characters" });
    }

    const request = await PasswordResetRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    const Model = request.role === "supervisor" ? Supervisor : Users;
    const user = await Model.findOne({ email: request.email });
    if (!user) return res.status(404).json({ success: false, message: "Account no longer exists" });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    request.status = "RESOLVED";
    request.note = `New password: ${newPassword}`;
    request.resolvedBy = req.user._id;
    request.resolvedAt = new Date();
    await request.save();

    res.json({ success: true, request });
  } catch (err) {
    console.error("Error resolving password reset request:", err);
    res.status(500).json({ success: false, message: "Server error while resolving request" });
  }
};
