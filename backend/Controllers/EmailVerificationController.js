const crypto = require("crypto");
const Users = require("../Models/Users");
const Supervisor = require("../Models/supervisorModel");
const Admin = require("../Models/Admin/AdminAuth");
const sendEmail = require("../utils/emailService");

const MODELS = { student: Users, supervisor: Supervisor, admin: Admin };
const VERIFY_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Generates a verification token for a freshly-created account and emails the link.
// Called directly from each signup controller (student/supervisor/admin) — not a route itself.
const sendVerificationEmail = async (account, role) => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  account.emailVerificationToken = hashToken(rawToken);
  account.emailVerificationExpires = new Date(Date.now() + VERIFY_TOKEN_EXPIRY_MS);
  await account.save();

  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const verifyLink = `${clientUrl}/${role}/verify-email/${rawToken}`;

  await sendEmail(
    account.email,
    "Verify Your Email Address",
    `<p>Hi ${account.name || "there"},</p>
     <p>Welcome to the FYP Management Portal! Please verify your email address to activate your account.</p>
     <p><a href="${verifyLink}">${verifyLink}</a></p>
     <p>This link expires in 24 hours.</p>`
  );
};

// POST /auth/verify-email  { role, token }
const verifyEmail = async (req, res) => {
  try {
    const { role, token } = req.body;
    const Model = MODELS[role];
    if (!Model) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required." });
    }

    const account = await Model.findOne({
      emailVerificationToken: hashToken(token),
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!account) {
      return res.status(400).json({ success: false, message: "Verification link is invalid or has expired." });
    }

    account.isEmailVerified = true;
    account.emailVerificationToken = null;
    account.emailVerificationExpires = null;
    await account.save();

    res.status(200).json({ success: true, message: "Email verified successfully. You can now log in." });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ success: false, message: "Server error while verifying email." });
  }
};

// POST /auth/resend-verification  { email, role }
const resendVerification = async (req, res) => {
  try {
    const { email, role } = req.body;
    const Model = MODELS[role];
    if (!Model) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const genericResponse = {
      success: true,
      message: "If an unverified account with that email exists, a new verification link has been sent.",
    };

    const account = await Model.findOne({ email });
    if (!account || account.isEmailVerified) {
      return res.status(200).json(genericResponse);
    }

    await sendVerificationEmail(account, role);
    res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ success: false, message: "Server error while resending verification email." });
  }
};

// POST /auth/check-verification  { email, role }
const checkVerification = async (req, res) => {
  try {
    const { email, role } = req.body;
    const Model = MODELS[role];
    if (!Model || !email) return res.status(400).json({ verified: false });
    const account = await Model.findOne({ email });
    if (!account) return res.status(404).json({ verified: false, message: "No account found with this email." });
    return res.json({ verified: !!account.isEmailVerified });
  } catch (error) {
    res.status(500).json({ verified: false, message: "Server error." });
  }
};

// POST /auth/change-pending-email  { email, newEmail, role }
const changePendingEmail = async (req, res) => {
  try {
    const { email, newEmail, role } = req.body;
    const Model = MODELS[role];
    if (!Model) return res.status(400).json({ success: false, message: "Invalid role." });
    if (!email || !newEmail) return res.status(400).json({ success: false, message: "Both current and new email are required." });
    if (!/\S+@\S+\.\S+/.test(newEmail)) return res.status(400).json({ success: false, message: "Invalid email format." });
    if (email.toLowerCase() === newEmail.toLowerCase()) return res.status(400).json({ success: false, message: "New email must be different from the current one." });

    const account = await Model.findOne({ email });
    if (!account) return res.status(404).json({ success: false, message: "No account found with this email." });
    if (account.isEmailVerified) return res.status(400).json({ success: false, message: "This account is already verified. Please log in." });

    const taken = await Model.findOne({ email: newEmail });
    if (taken) return res.status(400).json({ success: false, message: "This email is already registered." });

    account.email = newEmail;
    await sendVerificationEmail(account, role);

    res.status(200).json({ success: true, message: `Verification email sent to ${newEmail}. Please check your inbox.` });
  } catch (error) {
    console.error("Change pending email error:", error);
    res.status(500).json({ success: false, message: "Server error while changing email." });
  }
};

module.exports = { sendVerificationEmail, verifyEmail, resendVerification, changePendingEmail, checkVerification };
