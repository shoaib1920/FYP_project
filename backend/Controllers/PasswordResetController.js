const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Users = require("../Models/Users");
const Supervisor = require("../Models/supervisorModel");
const Admin = require("../Models/Admin/AdminAuth");
const sendEmail = require("../utils/emailService");

const MODELS = { student: Users, supervisor: Supervisor, admin: Admin };
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const findByEmailCaseInsensitive = (Model, email) =>
  Model.findOne({ email: { $regex: new RegExp(`^${escapeRegex(email.trim())}$`, "i") } });

// POST /auth/forgot-password  { email, role }
exports.forgotPassword = async (req, res) => {
  try {
    const { email, role } = req.body;
    const Model = MODELS[role];
    if (!Model) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    // Always return the same generic message whether or not the account exists,
    // so this endpoint can't be used to discover which emails are registered.
    const genericResponse = {
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    };

    const account = await findByEmailCaseInsensitive(Model, email);
    console.log(`[forgot-password] role=${role} email=${email} accountFound=${!!account}`);
    if (!account) {
      return res.status(200).json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    account.resetPasswordToken = hashToken(rawToken);
    account.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await account.save();

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const resetLink = `${clientUrl}/${role}/reset-password/${rawToken}`;

    await sendEmail(
      account.email,
      "Password Reset Request",
      `<p>Hi ${account.name || "there"},</p>
       <p>We received a request to reset your password. Click the link below to choose a new one. This link expires in 1 hour.</p>
       <p><a href="${resetLink}">${resetLink}</a></p>
       <p>If you didn't request this, you can safely ignore this email — your password will stay the same.</p>`
    );

    res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Server error while processing request." });
  }
};

// POST /auth/reset-password  { role, token, newPassword }
exports.resetPassword = async (req, res) => {
  try {
    const { role, token, newPassword } = req.body;
    const Model = MODELS[role];
    if (!Model) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Token and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const account = await Model.findOne({
      resetPasswordToken: hashToken(token),
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!account) {
      return res.status(400).json({ success: false, message: "Reset link is invalid or has expired." });
    }

    account.password = await bcrypt.hash(newPassword, 10);
    account.resetPasswordToken = null;
    account.resetPasswordExpires = null;
    await account.save();

    res.status(200).json({ success: true, message: "Password has been reset successfully. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Server error while resetting password." });
  }
};
