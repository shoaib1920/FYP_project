const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Supervisor = require("../models/supervisorModel");
const Department = require("../Models/Department");
const { sendVerificationEmail } = require("./EmailVerificationController");

// 👉 Supervisor Signup with Department Join Code
const supervisorSignup = async (req, res) => {
  try {
    const { name, email, password, phone, supervisorJoinCode ,employeeId, } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone || !supervisorJoinCode || !employeeId) {
      return res.status(400).json({
        success: false,
        message: "All fields (name, email, password, phone, supervisorJoinCode ,employeeId) are required.",
      });
    }

    // Check if supervisor already exists
    const existing = await Supervisor.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Supervisor already exists",
      });
    }

    // Verify supervisor join code
    const department = await Department.findOne({
      supervisorJoinCode: supervisorJoinCode.toUpperCase(),
      isActive: true,
    });

    if (!department) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired supervisor join code.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new supervisor
    const newSupervisor = new Supervisor({
      name,
      email,
      password: hashedPassword,
      phone,
      department: department._id,
      employeeId,
    });

    await newSupervisor.save();

    // Update department supervisor count
    await Department.findByIdAndUpdate(department._id, {
      $inc: { totalSupervisors: 1 },
    });

    await sendVerificationEmail(newSupervisor, "supervisor");

    // Send back response (no token — must verify email and log in separately)
    res.status(201).json({
      success: true,
      message: "Supervisor registered successfully. Please check your email to verify your account before logging in.",
      user: {
        _id: newSupervisor._id,
        name: newSupervisor.name,
        email: newSupervisor.email,
        phone: newSupervisor.phone,
        department: department.name,
        designation: newSupervisor.designation,
        employeeId: newSupervisor.employeeId,
        status: newSupervisor.status,
        createdAt: newSupervisor.createdAt,
      },
    });
  } catch (err) {
    console.error("Supervisor signup error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

// 👉 Login Controller
const supervisorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const supervisor = await Supervisor.findOne({ email });

    if (!supervisor) {
      return res.status(404).json({ success: false, message: "Supervisor not found" });
    }

    const isMatch = await bcrypt.compare(password, supervisor.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (supervisor.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact the admin.",
      });
    }

    if (!supervisor.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in. Check your inbox for the verification link.",
        unverified: true,
      });
    }

      const jwtToken = jwt.sign(
                {email: supervisor.email,_id: supervisor._id ,supervisorJoinCode: supervisor.supervisorJoinCode , employeeId: supervisor.employeeId},
                process.env.JWT_SECRET,
                {expiresIn: "24h"}
    
             )

    // ✅ Send supervisor data in response (only required fields)
    res.status(200).json({
      success: true,
      message: "Login successful",
      token:jwtToken,
      user: {
        _id: supervisor._id,
        name: supervisor.name,
        email: supervisor.email,
        phone: supervisor.phone,
        department: supervisor.department,
        designation: supervisor.designation,
        status: supervisor.status,
        createdAt: supervisor.createdAt,
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


module.exports = {
  supervisorSignup,
  supervisorLogin
};
