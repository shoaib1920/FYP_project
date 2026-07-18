const Admin = require('../Models/Admin/AdminAuth');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require("../Models/Users"); // or Supervisor/Admin model
const Project =  require("../Models/SupervisorModels/Project");
const AssignedProject = require("../Models/SupervisorModels/AssignedProject");
const { sendVerificationEmail } = require("./EmailVerificationController");

exports.admin_signup = async (req, res) => {
  const { name, email, password, signupCode } = req.body;
  try {
    // Admin accounts are the most privileged in the system — signup must be
    // gated behind a secret only the institution's deployer/IT owner knows,
    // never open to whoever finds the signup page. Fail closed: if the
    // server has no code configured, refuse every signup rather than
    // silently allowing unrestricted registration.
    if (!process.env.ADMIN_SIGNUP_CODE) {
      return res.status(500).json({ message: "Admin signup is not configured. Contact the system administrator." });
    }
    if (!signupCode || signupCode !== process.env.ADMIN_SIGNUP_CODE) {
      return res.status(403).json({ message: "Invalid admin signup code." });
    }

    const existing = await Admin.findOne({ email });
    if (existing) return res.status(400).json({ message: "Admin already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({ name, email, password: hashed });
    await newAdmin.save();
    await sendVerificationEmail(newAdmin, "admin");
    res.status(201).json({ message: "Admin created successfully. Please check your email to verify your account before logging in." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.admin_login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ message: "Invalid password" });

    if (!admin.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in. Check your inbox for the verification link.",
        unverified: true,
      });
    }

    const token = jwt.sign(
  { _id: admin._id },
  process.env.JWT_SECRET,   // ← use the same env var as everywhere else
  { expiresIn: '1d' }
);


    // send token + selected admin fields
    res.json({
      token,
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        avatar: admin.avatar // make sure this field exists in your Admin model
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getAllAdmins = async (req, res) => {
  try {
    // Only what chat/contact-list UIs actually need — never leak password
    // hashes or reset/verification tokens, even to authenticated callers.
    const admins = await Admin.find().select("name email designation");
    res.status(200).json({ admins });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ error: "Failed to fetch admins" });
  }
};


exports.updateProjectStatus = async (req, res) => {
  const { projectId } = req.params;
  const { status } = req.body;

  try {
    const updatedAssignedProject = await AssignedProject.findOneAndUpdate(
      { 'projectId': projectId },
      { status },
      { new: true }
    );

    if (!updatedAssignedProject) {
      return res.status(404).json({ message: "Assigned project not found" });
    }

    res.status(200).json(updatedAssignedProject);
  } catch (error) {
    console.error("Error updating assigned project status:", error);
    res.status(500).json({ message: "Server error" });
  }
};