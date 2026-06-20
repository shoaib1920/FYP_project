const jwt = require('jsonwebtoken');
const userModel = require("../Models/Users");
const Supervisor = require("../Models/supervisorModel");
const Admin = require("../Models/Admin/AdminAuth");

/**
 * Authenticate middleware - verifies JWT token
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized: Token missing' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

/**
 * Role-based authorization middleware
 * Usage: router.get("/some-route", authenticate, authorize("student", "supervisor"))
 */
const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;

      // Check if user is a student
      const student = await userModel.findById(userId);
      if (student && allowedRoles.includes("student")) {
        req.role = "student";
        return next();
      }

      // Check if user is a supervisor
      const supervisor = await Supervisor.findById(userId);
      if (supervisor && allowedRoles.includes("supervisor")) {
        req.role = "supervisor";
        return next();
      }

      // Check if user is an admin
      const admin = await Admin.findById(userId);
      if (admin && allowedRoles.includes("admin")) {
        req.role = "admin";
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Access denied. Allowed roles: ${allowedRoles.join(", ")}`
      });
    } catch (error) {
      console.error("Authorization error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error during authorization"
      });
    }
  };
};

/**
 * Verify student role
 */
const verifyStudent = (req, res, next) => {
  // This middleware checks if the user is a student
  // It should be used after authenticate middleware
  return authorize("student")(req, res, next);
};

/**
 * Verify supervisor role
 */
const verifySupervisor = (req, res, next) => {
  // This middleware checks if the user is a supervisor
  // It should be used after authenticate middleware
  return authorize("supervisor")(req, res, next);
};

/**
 * Verify admin role
 */
const verifyAdmin = (req, res, next) => {
  // This middleware checks if the user is an admin
  // It should be used after authenticate middleware
  return authorize("admin")(req, res, next);
};

module.exports = {
  authenticate,
  authorize,
  verifyStudent,
  verifySupervisor,
  verifyAdmin
};
