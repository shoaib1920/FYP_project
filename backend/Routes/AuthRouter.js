const route = require("express").Router();
const multer = require("multer");
const path = require("path");
const { signup, login, studentSignup } = require("../Controllers/AuthController");
const {
  signupValidation,
  loginValidation,
} = require("../Middlewares/AuthValidation"); // Middleware for validation
const { UserList } = require("../Controllers/UserController");
const {
  createTask,
  TaskList,
  updateTask,
  deleteTask,
  submitProject,
  approveTask,
  subProject,
  rejectTask,
} = require("../Controllers/TaskController");
const {
  assignTask,
  getAssignments,
  getMyAssignments,
  getOtherAssignments,
  deleteAssignment,
  updateAssignment,
  getProjectsByStudent,
} = require("../Controllers/AssignTaskController");
const {
  getTaskSummary,
  getTaskProgress,
  getLeaderboard,
  getRecentTasks,
} = require("../Controllers/DashboardController");
const {
  uploadGlobalTemplate,
  uploadProjectTemplate,
  getGlobalTemplates,
  getProjectTemplates,
  getSupervisorTemplates,
  getAdminTemplates,
  deleteTemplate,
  // legacy aliases kept for old callers
  getAllTemplates,
  createTemplate,
} = require("../Controllers/TemplateController.js");
const {
  sendMessage,
  getMessages,
  getAllMessages,
  uploadChatFile,
  markAsRead,
  getUsersStatus,
} = require("../Controllers/MessageController.js.js");
const authenticate = require("../Middlewares/authenticate.js"); // JWT middleware
const {
  submitFeedback,
  getFeedbacks,
} = require("../Controllers/FeedbackController");
const { supervisorSignup, supervisorLogin } = require("../Controllers/SupervisorAuthController");
const { createProject, getAllProjects,assignProject,getSupervisorProjectStats ,AssignedProjectList,getAllSupervisors  ,submitFinalProject, getAllSupervisorsForAdmin, updateSupervisorStatus, updateSupervisorDepartment } = require("../Controllers/SupervisorProjectController");
const { createTeam, getAllTeams } = require("../Controllers/TeamController");
const {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  verifyStudentJoinCode,
  verifySupervisorJoinCode,
  regenerateStudentJoinCode,
  regenerateSupervisorJoinCode,
  getDepartmentStats,
  getUserDepartment,
  getSupervisorDepartments,
  getMyDepartment,
} = require("../Controllers/DepartmentController");

const {
  submitProposal,
  updateProposal,
  getStudentProposals,
  getTeamProposals,
  getAdminProposals,
  getSupervisorProposals,
  updateProposalStatus,
  assignSupervisor,
  supervisorDecision,
  getProposalById
} = require("../Controllers/ProposalController");

const { 
  getNotifications,
  notificationmarkAsRead,
  deleteNotification,
  markAllAsRead,
  clearAllNotifications
} = require("../Controllers/NotificationController");

const { admin_signup, admin_login,getAllAdmins,updateProjectStatus  } = require('../Controllers/adminController.js');
const { forgotPassword, resetPassword } = require('../Controllers/PasswordResetController');
const { verifyEmail, resendVerification } = require('../Controllers/EmailVerificationController');

// setup multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/templates/"); // or any path you want
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

const proposalStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/proposals/");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const proposalUpload = multer({
  storage: proposalStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed for proposal report."));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

const chatStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/chat/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max for videos
});

route.put('/update-project-status/:projectId', updateProjectStatus);

// ─── TEMPLATE ROUTES ─────────────────────────────────────────────────────────
route.post("/templates/global",              authenticate, upload.single("template"), uploadGlobalTemplate);
route.post("/templates/project",             authenticate, upload.single("template"), uploadProjectTemplate);
route.get("/templates/global",               authenticate, getGlobalTemplates);
route.get("/templates/project/:fypProjectId",authenticate, getProjectTemplates);
route.get("/templates/supervisor",           authenticate, getSupervisorTemplates);
route.get("/templates/admin",                authenticate, getAdminTemplates);
route.delete("/templates/:id",               authenticate, deleteTemplate);
// legacy read-all (old student component fallback)
route.get("/templates",                      getAllTemplates);

// 🎓 FYP PROPOSAL WORKFLOW ROUTES
// Student: Submit and update proposals
route.post('/proposals/submit', authenticate, proposalUpload.single('proposalReport'), submitProposal);
route.put('/proposals/:proposalId', authenticate, proposalUpload.single('proposalReport'), updateProposal);

// Fetch proposals by role
route.get('/proposals/student', authenticate, getStudentProposals);
route.get('/proposals/team/:teamId', authenticate, getTeamProposals);
route.get('/proposals/admin', authenticate, getAdminProposals);
route.get('/proposals/supervisor', authenticate, getSupervisorProposals);
route.get('/proposals/:proposalId', authenticate, getProposalById);

// Admin: Review and manage proposals
route.put('/proposals/:proposalId/status', authenticate, updateProposalStatus);
route.put('/proposals/:proposalId/assign-supervisor', authenticate, assignSupervisor);

// Supervisor: Make decision on assigned proposals
route.put('/proposals/:proposalId/decision', authenticate, supervisorDecision);

// 🔔 NOTIFICATION ROUTES
// Get all notifications for the authenticated user
route.get('/notifications', authenticate, getNotifications);

// Mark a specific notification as read
route.put('/notifications/:notificationId/read', authenticate, notificationmarkAsRead);

// Delete a specific notification
route.delete('/notifications/:notificationId', authenticate, deleteNotification);

// Mark all notifications as read
route.put('/notifications/all/read', authenticate, markAllAsRead);

// Clear all notifications (delete all)
route.delete('/notifications/all/clear', authenticate, clearAllNotifications);

// Route to submit a project (change status to "approval")
route.put('/submit/:id', submitFinalProject);



// Route to get assigned project stats for a supervisor
route.get('/assigned-projects', AssignedProjectList); // Get all assigned projects

route.get('/assigned-projects/stats/:supervisorId', getSupervisorProjectStats);
// Create a Project
route.post("/create-project", createProject);

route.post('/create-team', createTeam); // Create a team\

// Get all Projects
route.get("/projects", getAllProjects);

route.post('/admin_signup', admin_signup);
route.post('/admin_login', admin_login);
// GET /api/admins
route.get("/admins", getAllAdmins);


// Assign Project
route.post("/assign-project", assignProject);  // ✅ Corrected POST
route.post("/sub-project", subProject);


  route.get("/teams", getAllTeams);

  route.get('/student-project/:userId', getProjectsByStudent); // ✅ Corrected route to get projects by student ID


// Route to get all supervisors
route.get("/supervisors", getAllSupervisors);

// 🧑‍🏫 ADMIN SUPERVISOR MANAGEMENT ROUTES
route.get("/admin/supervisors", authenticate, getAllSupervisorsForAdmin);
route.put("/admin/supervisors/:id/status", authenticate, updateSupervisorStatus);
route.put("/admin/supervisors/:id/department", authenticate, updateSupervisorDepartment);



// 👉 Supervisor Signup Route
route.post("/supervisor/signup", supervisorSignup);


route.get("/chat-senders/:userId",getAllMessages);

// 👉 Supervisor Login Route
route.post("/supervisor/login", supervisorLogin);

// 🚪 Supervisor department info
route.get("/supervisor/departments", authenticate, getSupervisorDepartments);
route.get("/supervisor/my-department", authenticate, getMyDepartment);

route.post("/Feedback/submit", submitFeedback);
route.get("/Feedback/list", getFeedbacks);

route.post("/submit-project", submitProject);
route.post("/approve-task/:id", approveTask);
route.post("/reject-task/:id", rejectTask);

// Chat routes
route.post("/messages/send", authenticate, sendMessage);
route.get("/messages/:receiverId", authenticate, getMessages);
route.put("/messages/read/:senderId", authenticate, markAsRead);
route.post("/messages/upload", authenticate, chatUpload.single("file"), uploadChatFile);
route.post("/users/status", authenticate, getUsersStatus);

route.post("/task", createTask);
route.put("/task/:id", updateTask);
route.delete("/task/:id", deleteTask);
// 🔑 Password reset (works for student/supervisor/admin via { role } in the body)
route.post("/forgot-password", forgotPassword);
route.post("/reset-password", resetPassword);

// ✉️ Email verification (works for student/supervisor/admin via { role } in the body)
route.post("/verify-email", verifyEmail);
route.post("/resend-verification", resendVerification);

route.post("/signup", signupValidation, signup);
route.post("/student/signup", studentSignup); // ✅ Student signup with department join code
route.post("/login", loginValidation, login);
route.get("/users", UserList);
route.get("/assigned-tasks", getAssignments);
route.get("/Myassigned-tasks", getMyAssignments);
route.get("/Otherassigned-tasks", getOtherAssignments);
route.post("/assigntask", assignTask);
route.get("/tasks", TaskList);
// ✅ Add missing routes for assignments
route.put("/assigntask/:id", updateAssignment); // ✅ Update an assigned task
route.delete("/assigntask/:id", deleteAssignment); // ✅ Delete an assigned task

route.get("/dashboard/tasks", TaskList);

// ✅ Route to fetch task summary (Total, Completed, Pending)
route.get("/dashboard/task-summary", getTaskSummary);

// ✅ Route to fetch task progress over time
route.get("/dashboard/task-progress", getTaskProgress);

// ✅ Route to fetch leaderboard
route.get("/dashboard/leaderboard", getLeaderboard);

// ✅ Route to fetch recent tasks
route.get("/dashboard/recent-tasks", getRecentTasks);

// 🏛️ Department Management Routes (Admin Only)
route.post("/admin/department", createDepartment); // Create department
route.get("/admin/department", getAllDepartments); // Get all departments
route.get("/admin/department/:id", getDepartmentById); // Get department by ID
route.put("/admin/department/:id", updateDepartment); // Update department
route.delete("/admin/department/:id", deleteDepartment); // Delete department

// 🔐 Join Code Verification Routes
route.post("/verify-student-join-code", verifyStudentJoinCode); // Verify student join code
route.post("/verify-supervisor-join-code", verifySupervisorJoinCode); // Verify supervisor join code

// 🔄 Join Code Regeneration Routes (Admin Only)
route.post("/admin/department/:id/regenerate-student-code", regenerateStudentJoinCode);
route.post("/admin/department/:id/regenerate-supervisor-code", regenerateSupervisorJoinCode);

// 📊 Department Statistics
route.get("/admin/department/:id/stats", getDepartmentStats);

// 👤 Get User's Department Info
route.get("/department/:departmentId", getUserDepartment);

// ─────────────────────────────────────────────
// 📁 PROJECT MANAGEMENT ROUTES
// ─────────────────────────────────────────────
const {
  getProjectById,
  getProjectsByTeam,
  getProjectsBySupervisor,
  updateProjectDetails,
  updateProjectProgress,
  submitFinalReport,
  completeProject,
  reGradeProject,
  getAllProjectsForAdmin,
  getCompletedProjectsForAdmin,
  releaseGrades,
  flagGrades,
} = require("../Controllers/ProjectController");

const finalReportStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/final-reports/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const finalReportUpload = multer({
  storage: finalReportStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed for final report."));
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

route.get("/projects/team/:teamId", authenticate, getProjectsByTeam);
route.get("/projects/supervisor", authenticate, getProjectsBySupervisor);
route.get("/projects/:projectId", authenticate, getProjectById);
route.put("/projects/:projectId/details", authenticate, updateProjectDetails);
route.put("/projects/:projectId/progress", authenticate, updateProjectProgress);
route.put("/projects/:projectId/final-report", authenticate, finalReportUpload.single("finalReport"), submitFinalReport);
route.put("/projects/:projectId/complete", authenticate, completeProject);
route.put("/projects/:projectId/regrade", authenticate, reGradeProject);

// 🎓 ADMIN GRADE MANAGEMENT ROUTES
route.get("/admin/projects", authenticate, getAllProjectsForAdmin);
route.get("/admin/projects/grades", authenticate, getCompletedProjectsForAdmin);
route.put("/admin/projects/:projectId/release-grades", authenticate, releaseGrades);
route.put("/admin/projects/:projectId/flag-grades", authenticate, flagGrades);

// ─────────────────────────────────────────────
// 📋 PROGRESS LOG ROUTES
// ─────────────────────────────────────────────
const {
  submitProgressLog,
  getProjectProgressLogs,
  reviewProgressLog,
} = require("../Controllers/ProgressLogController");

route.post("/progress-logs", authenticate, submitProgressLog);
route.get("/progress-logs/:projectId", authenticate, getProjectProgressLogs);
route.put("/progress-logs/:logId/review", authenticate, reviewProgressLog);

// ─────────────────────────────────────────────
// 🗓️ MEETING LOG ROUTES
// ─────────────────────────────────────────────
const {
  scheduleMeeting,
  getProjectMeetings,
  updateMeetingMinutes,
  updateMeetingStatus,
} = require("../Controllers/MeetingLogController");

route.post("/meetings", authenticate, scheduleMeeting);
route.get("/meetings/:projectId", authenticate, getProjectMeetings);
route.put("/meetings/:meetingId/minutes", authenticate, updateMeetingMinutes);
route.put("/meetings/:meetingId/status", authenticate, updateMeetingStatus);

// ─────────────────────────────────────────────
// 🗓️ ACADEMIC CALENDAR / DEADLINES
// ─────────────────────────────────────────────
const {
  createTerm,
  getAllTerms,
  updateTerm,
  deleteTerm,
  activateTerm,
  getCurrentTerm,
} = require("../Controllers/AcademicTermController");

const { getMyGroups, getGroupMessages } = require("../Controllers/GroupChatController");
route.get("/group-chats", authenticate, getMyGroups);
route.get("/group-chats/:teamId/messages", authenticate, getGroupMessages);

// ─────────────────────────────────────────────
// 🤖 AI CODING ASSISTANT (Gemini)
// ─────────────────────────────────────────────
const { sendMessage: sendAIMessage, getHistory: getAIHistory, clearHistory: clearAIHistory } = require("../Controllers/AIChatController");
route.post("/ai/chat", authenticate, sendAIMessage);
route.get("/ai/history", authenticate, getAIHistory);
route.delete("/ai/history", authenticate, clearAIHistory);

route.post("/admin/academic-terms", authenticate, createTerm);
route.get("/admin/academic-terms", authenticate, getAllTerms);
route.put("/admin/academic-terms/:id", authenticate, updateTerm);
route.delete("/admin/academic-terms/:id", authenticate, deleteTerm);
route.put("/admin/academic-terms/:id/activate", authenticate, activateTerm);
route.get("/academic-terms/current", authenticate, getCurrentTerm);

module.exports = route;
