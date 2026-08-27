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
const { authorize } = require("../Middlewares/authMiddleware"); // role-based access control
const {
  submitFeedback,
  getFeedbacks,
} = require("../Controllers/FeedbackController");
const { supervisorSignup, supervisorLogin } = require("../Controllers/SupervisorAuthController");
const { createProject, getAllProjects,assignProject,getSupervisorProjectStats ,AssignedProjectList,getAllSupervisors  ,submitFinalProject, getAllSupervisorsForAdmin, updateSupervisorStatus, updateSupervisorDepartment } = require("../Controllers/SupervisorProjectController");
const { createTeam, getAllTeams, getMyTeams, respondToInvite, inviteMoreMembers, cancelInvite, removeMember } = require("../Controllers/TeamController");
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
  analyzeProposalDraft,
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

// const {getAIHistory,sendAIMessage, clearAIHistory} = require("../Controllers/AIChatController.js");

const { admin_signup, admin_login,getAllAdmins,updateProjectStatus  } = require('../Controllers/adminController.js');
const { forgotPassword, resetPassword } = require('../Controllers/PasswordResetController');
const { verifyEmail, resendVerification, changePendingEmail, checkVerification } = require('../Controllers/EmailVerificationController');

// ── Multer: local disk storage ────────────────────────────────────────────────
const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/templates/"),
  filename:    (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage: templateStorage });

const proposalStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/proposals/"),
  filename:    (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const proposalUpload = multer({
  storage: proposalStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed for proposal report."));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/chat/"),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
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
route.post('/proposals/analyze-quality', authenticate, authorize("student"), analyzeProposalDraft);
route.put('/proposals/:proposalId', authenticate, proposalUpload.single('proposalReport'), updateProposal);

// Fetch proposals by role
route.get('/proposals/student', authenticate, getStudentProposals);
route.get('/proposals/team/:teamId', authenticate, getTeamProposals);
route.get('/proposals/admin', authenticate, getAdminProposals);
route.get('/proposals/supervisor', authenticate, getSupervisorProposals);
route.get('/proposals/:proposalId', authenticate, getProposalById);

// Admin: Review and manage proposals
route.put('/proposals/:proposalId/status', authenticate, authorize("admin"), updateProposalStatus);
route.put('/proposals/:proposalId/assign-supervisor', authenticate, authorize("admin"), assignSupervisor);

// Supervisor: Make decision on assigned proposals
route.put('/proposals/:proposalId/decision', authenticate, authorize("supervisor"), supervisorDecision);

// 🔔 NOTIFICATION ROUTES
// Get all notifications for the authenticated user
route.get('/notifications', authenticate, getNotifications);

// Mark all notifications as read (must come before the :notificationId route below,
// otherwise "all" gets captured as a notificationId and the wrong handler runs)
route.put('/notifications/all/read', authenticate, markAllAsRead);

// Clear all notifications (delete all)
route.delete('/notifications/all/clear', authenticate, clearAllNotifications);

// Mark a specific notification as read
route.put('/notifications/:notificationId/read', authenticate, notificationmarkAsRead);

// Delete a specific notification
route.delete('/notifications/:notificationId', authenticate, deleteNotification);

// Route to submit a project (change status to "approval")
route.put('/submit/:id', submitFinalProject);



// Route to get assigned project stats for a supervisor
route.get('/assigned-projects', AssignedProjectList); // Get all assigned projects

route.get('/assigned-projects/stats/:supervisorId', getSupervisorProjectStats);
// Create a Project
route.post("/create-project", createProject);

route.post('/create-team', authenticate, createTeam); // Create a team — creator comes from the JWT, not the request body
route.get('/my-teams', authenticate, getMyTeams); // Teams I'm in + invites awaiting my response
route.put('/teams/:teamId/invites/respond', authenticate, respondToInvite); // Accept or decline a team invite
route.post('/teams/:teamId/invites', authenticate, inviteMoreMembers); // Leader invites more students to an existing team
route.delete('/teams/:teamId/invites/:studentId', authenticate, cancelInvite); // Leader cancels a not-yet-answered invite
route.delete('/teams/:teamId/members/:memberId', authenticate, removeMember); // Leader removes an already-joined member

// Get all Projects
route.get("/projects", getAllProjects);

route.post('/admin_signup', admin_signup);
route.post('/admin_login', admin_login);
// GET /api/admins
route.get("/admins", authenticate, getAllAdmins); // any logged-in role (used for chat contact lists), never anonymous


// Assign Project
route.post("/assign-project", assignProject);  // ✅ Corrected POST
route.post("/sub-project", subProject);


  route.get("/teams", authenticate, getAllTeams);

  route.get('/student-project/:userId', authenticate, getProjectsByStudent); // Student's own projects only


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
route.post("/change-pending-email", changePendingEmail);
route.post("/check-verification", checkVerification);

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
route.post("/admin/department", authenticate, authorize("admin"), createDepartment); // Create department
route.get("/admin/department", authenticate, authorize("admin"), getAllDepartments); // Get all departments
route.get("/admin/department/:id", authenticate, authorize("admin"), getDepartmentById); // Get department by ID
route.put("/admin/department/:id", authenticate, authorize("admin"), updateDepartment); // Update department
route.delete("/admin/department/:id", authenticate, authorize("admin"), deleteDepartment); // Delete department

// 🔐 Join Code Verification Routes (public — used during signup, before login)
route.post("/verify-student-join-code", verifyStudentJoinCode); // Verify student join code
route.post("/verify-supervisor-join-code", verifySupervisorJoinCode); // Verify supervisor join code

// 🔄 Join Code Regeneration Routes (Admin Only)
route.post("/admin/department/:id/regenerate-student-code", authenticate, authorize("admin"), regenerateStudentJoinCode);
route.post("/admin/department/:id/regenerate-supervisor-code", authenticate, authorize("admin"), regenerateSupervisorJoinCode);

// 📊 Department Statistics
route.get("/admin/department/:id/stats", authenticate, authorize("admin"), getDepartmentStats);

// 👤 Get User's Department Info
route.get("/department/:departmentId", authenticate, getUserDepartment);

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
  rejectFinalReport,
  reGradeProject,
  gradePhase,
  saveGradeDraft,
  getAllProjectsForAdmin,
  getCompletedProjectsForAdmin,
  releaseGrades,
  flagGrades,
  scheduleViva,
  gradeViva,
  getMyViva,
  getSupervisorSchedule,
  getAdminVivaSchedule,
  analyzeFinalReport,
  checkCopyleaksAI,
  requestGradeAppeal,
  resolveGradeAppeal,
} = require("../Controllers/ProjectController");
const { getProjectDocuments } = require("../Controllers/ProjectDocumentsController");
const { archiveProjectCode, uploadCodeZip } = require("../Controllers/CodeArchiveController");

const finalReportStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/final-reports/"),
  filename:    (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const ALLOWED_FINAL_REPORT_MIMES = [
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];
const finalReportUpload = multer({
  storage: finalReportStorage,
  fileFilter: (req, file, cb) => {
    // Some browsers send a generic mimetype for .doc/.docx — fall back to extension.
    const ext = (file.originalname.split(".").pop() || "").toLowerCase();
    const allowedByExt = ["pdf", "doc", "docx"].includes(ext);
    if (!ALLOWED_FINAL_REPORT_MIMES.includes(file.mimetype) && !allowedByExt) {
      return cb(new Error("Only PDF or Word (.doc/.docx) files are allowed for the final report."));
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

const codeZipStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = `uploads/code-archives/${req.params.projectId}`;
    require("fs").mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, "source-" + Date.now() + ".zip"),
});
const codeZipUpload = multer({
  storage: codeZipStorage,
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname.split(".").pop() || "").toLowerCase();
    if (ext !== "zip" && file.mimetype !== "application/zip" && file.mimetype !== "application/x-zip-compressed") {
      return cb(new Error("Only a .zip file is allowed for the source code archive."));
    }
    cb(null, true);
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // source code can run larger than a report
});

route.get("/my-viva", authenticate, getMyViva); // The logged-in student's own upcoming/recent viva, if any
route.get("/supervisor/schedule", authenticate, authorize("supervisor"), getSupervisorSchedule); // Consolidated upcoming vivas + meetings
route.get("/projects/team/:teamId", authenticate, getProjectsByTeam);
route.get("/projects/supervisor", authenticate, getProjectsBySupervisor);
route.get("/projects/:projectId", authenticate, getProjectById);
route.get("/projects/:projectId/documents", authenticate, getProjectDocuments); // Consolidated read-only view of every document tied to this project
route.put("/projects/:projectId/details", authenticate, updateProjectDetails);
route.put("/projects/:projectId/progress", authenticate, updateProjectProgress);
route.put("/projects/:projectId/final-report", authenticate, finalReportUpload.single("finalReport"), submitFinalReport);
route.put("/projects/:projectId/reject-final-report", authenticate, authorize("supervisor"), rejectFinalReport); // Supervisor sends a submitted report back with a reason
route.post("/projects/:projectId/analyze-report", authenticate, authorize("supervisor"), analyzeFinalReport); // On-demand AI re-check of the final report
route.post("/projects/:projectId/copyleaks-check", authenticate, authorize("supervisor"), checkCopyleaksAI); // On-demand Copyleaks AI-content check
route.post("/projects/:projectId/archive-code", authenticate, authorize("admin"), archiveProjectCode); // On-demand full-history git mirror of the team's repo
route.put("/projects/:projectId/upload-code-zip", authenticate, codeZipUpload.single("codeZip"), uploadCodeZip); // Fallback when the clone attempt fails
route.put("/projects/:projectId/complete", authenticate, authorize("supervisor"), completeProject);
route.put("/projects/:projectId/regrade", authenticate, authorize("supervisor"), reGradeProject);
route.put("/projects/:projectId/request-appeal", authenticate, requestGradeAppeal); // Team leader appeals a released grade
route.put("/projects/:projectId/grade-phase", authenticate, authorize("supervisor"), gradePhase);
route.put("/projects/:projectId/grade-draft", authenticate, authorize("supervisor"), saveGradeDraft);

// 🎓 ADMIN GRADE MANAGEMENT ROUTES
route.get("/admin/projects", authenticate, authorize("admin"), getAllProjectsForAdmin);
route.get("/admin/projects/grades", authenticate, authorize("admin"), getCompletedProjectsForAdmin);
route.put("/admin/projects/:projectId/release-grades", authenticate, authorize("admin"), releaseGrades);
route.put("/admin/projects/:projectId/flag-grades", authenticate, authorize("admin"), flagGrades);
route.put("/admin/projects/:projectId/resolve-appeal", authenticate, authorize("admin"), resolveGradeAppeal);
route.put("/admin/projects/:projectId/schedule-viva", authenticate, authorize("admin"), scheduleViva);
route.put("/admin/projects/:projectId/grade-viva",    authenticate, authorize("admin"),    gradeViva);
route.get("/admin/viva-schedule", authenticate, authorize("admin"), getAdminVivaSchedule); // Department-wide upcoming vivas

// ─────────────────────────────────────────────
// 🧾 AUDIT LOG ROUTES (admin only)
// ─────────────────────────────────────────────
const { getAuditLogs, getAuditActionTypes } = require("../Controllers/AuditLogController");
route.get("/admin/audit-logs", authenticate, authorize("admin"), getAuditLogs);
route.get("/admin/audit-logs/actions", authenticate, authorize("admin"), getAuditActionTypes);

// ─────────────────────────────────────────────
// 📊 ANALYTICS (admin only)
// ─────────────────────────────────────────────
const { getAnalytics } = require("../Controllers/AnalyticsController");
route.get("/admin/analytics", authenticate, authorize("admin"), getAnalytics);

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
// 🖍️ LIVE PROJECT REVIEW NOTES (supervisor marks issues on the live preview)
// ─────────────────────────────────────────────
const {
  createReviewNote,
  getProjectReviewNotes,
  resolveReviewNote,
} = require("../Controllers/ProjectReviewNoteController");

const reviewNoteStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/review-notes/"),
  filename:    (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const reviewNoteUpload = multer({
  storage: reviewNoteStorage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image screenshots are allowed for review notes."));
    }
    cb(null, true);
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

route.post("/review-notes", authenticate, authorize("supervisor"), reviewNoteUpload.array("screenshots", 20), createReviewNote);
route.get("/review-notes/:projectId", authenticate, getProjectReviewNotes);
route.put("/review-notes/:noteId/resolve", authenticate, authorize("student"), resolveReviewNote);

// ─────────────────────────────────────────────
// 🗓️ MEETING LOG ROUTES
// ─────────────────────────────────────────────
const {
  scheduleMeeting,
  getProjectMeetings,
  updateMeetingMinutes,
  updateMeetingStatus,
} = require("../Controllers/MeetingLogController");

route.post("/meetings", authenticate, authorize("supervisor"), scheduleMeeting);
route.get("/meetings/:projectId", authenticate, getProjectMeetings); // students + supervisor both read this
route.put("/meetings/:meetingId/minutes", authenticate, authorize("supervisor"), updateMeetingMinutes);
route.put("/meetings/:meetingId/status", authenticate, authorize("supervisor"), updateMeetingStatus);

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

const {
  getMyDepartments,
  getDepartmentMessages,
  getModerationMembers,
  muteMember,
  unmuteMember,
  excludeMember,
  restoreMember,
} = require("../Controllers/DepartmentChatController");
route.get("/department-chat/my-departments", authenticate, getMyDepartments); // Which department chat(s) this user belongs to
route.get("/department-chat/:departmentId/messages", authenticate, getDepartmentMessages);
route.get("/admin/department-chat/:departmentId/members", authenticate, authorize("admin"), getModerationMembers);
route.put("/admin/department-chat/:departmentId/mute/:userId", authenticate, authorize("admin"), muteMember);
route.put("/admin/department-chat/:departmentId/unmute/:userId", authenticate, authorize("admin"), unmuteMember);
route.put("/admin/department-chat/:departmentId/exclude/:userId", authenticate, authorize("admin"), excludeMember);
route.put("/admin/department-chat/:departmentId/restore/:userId", authenticate, authorize("admin"), restoreMember);

// ─────────────────────────────────────────────
// 🤖 AI CODING ASSISTANT (Gemini)
// ─────────────────────────────────────────────
const { sendAIMessage,  getAIHistory,  clearAIHistory } = require("../Controllers/AIChatController");
route.post("/ai/chat", authenticate, sendAIMessage);
route.get("/ai/history", authenticate, getAIHistory);
route.delete("/ai/history", authenticate, clearAIHistory);

route.post("/admin/academic-terms", authenticate, createTerm);
route.get("/admin/academic-terms", authenticate, getAllTerms);
route.put("/admin/academic-terms/:id", authenticate, updateTerm);
route.delete("/admin/academic-terms/:id", authenticate, deleteTerm);
route.put("/admin/academic-terms/:id/activate", authenticate, activateTerm);
route.get("/academic-terms/current", authenticate, getCurrentTerm);

// ─────────────────────────────────────────────
// 🗓️ ACADEMIC SESSIONS (admin-managed list of session tags, e.g. "2022-2026")
// ─────────────────────────────────────────────
const {
  createSession,
  getAllSessions,
  updateSession,
  deleteSession,
} = require("../Controllers/AcademicSessionController");
route.post("/admin/sessions", authenticate, authorize("admin"), createSession);
route.get("/sessions", authenticate, getAllSessions);
route.put("/admin/sessions/:id", authenticate, authorize("admin"), updateSession);
route.delete("/admin/sessions/:id", authenticate, authorize("admin"), deleteSession);

// ─────────────────────────────────────────────
// 🧑‍⚖️ EVALUATION PANELS (admin-defined groups of faculty evaluators)
// ─────────────────────────────────────────────
const {
  createPanel,
  getAllPanels,
  getMyPanels,
  updatePanel,
  deletePanel,
} = require("../Controllers/EvaluationPanelController");
route.post("/admin/panels", authenticate, authorize("admin"), createPanel);
route.get("/panels", authenticate, getAllPanels);
route.get("/faculty/my-panels", authenticate, authorize("supervisor"), getMyPanels);
route.put("/admin/panels/:id", authenticate, authorize("admin"), updatePanel);
route.delete("/admin/panels/:id", authenticate, authorize("admin"), deletePanel);

// ─────────────────────────────────────────────
// 📐 EVALUATION PHASES (admin-defined phase templates — flexible replacement
// for the old fixed INTERNAL/MIDTERM/FINAL enum; that old data model on
// Project.evaluationPhases is untouched and keeps working for old projects)
// ─────────────────────────────────────────────
const {
  createPhase,
  getAllPhases,
  updatePhase,
  deletePhase,
} = require("../Controllers/EvaluationPhaseController");
route.post("/admin/phases", authenticate, authorize("admin"), createPhase);
route.get("/phases", authenticate, getAllPhases);
route.put("/admin/phases/:id", authenticate, authorize("admin"), updatePhase);
route.delete("/admin/phases/:id", authenticate, authorize("admin"), deletePhase);

// ─────────────────────────────────────────────
// 📅 PHASE SCHEDULES (a phase assigned to a group, for one attempt)
// ─────────────────────────────────────────────
const {
  createSchedule,
  getAllSchedules,
  getMySchedulesAsEvaluator,
  getTeamSchedules,
  updateSchedule,
  deleteSchedule,
  retrySchedule,
} = require("../Controllers/PhaseScheduleController");
route.post("/admin/phase-schedules", authenticate, authorize("admin"), createSchedule);
route.get("/admin/phase-schedules", authenticate, authorize("admin"), getAllSchedules);
route.get("/faculty/phase-schedules", authenticate, authorize("supervisor"), getMySchedulesAsEvaluator);
route.get("/student/phase-schedules/:teamId", authenticate, getTeamSchedules);
route.put("/admin/phase-schedules/:id", authenticate, authorize("admin"), updateSchedule);
route.delete("/admin/phase-schedules/:id", authenticate, authorize("admin"), deleteSchedule);
route.post("/admin/phase-schedules/:id/retry", authenticate, authorize("admin"), retrySchedule);

// ─────────────────────────────────────────────
// 📝 PHASE MARKS (evaluator marks submission, admin adjustment, pass/fail results)
// ─────────────────────────────────────────────
const {
  submitMarks,
  getAllMarks,
  adjustMark,
  getResults,
} = require("../Controllers/PhaseMarkController");
route.post("/faculty/phase-marks", authenticate, authorize("supervisor"), submitMarks);
route.get("/admin/phase-marks", authenticate, authorize("admin"), getAllMarks);
route.put("/admin/phase-marks/:id", authenticate, authorize("admin"), adjustMark);
route.get("/phase-results", authenticate, getResults);

// ─────────────────────────────────────────────
// 📎 PHASE DOCUMENTS (student uploads tied to a phase schedule)
// ─────────────────────────────────────────────
const {
  uploadDocument,
  getDocuments,
  getTeamDocuments,
} = require("../Controllers/PhaseDocumentController");
const phaseDocumentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/phase-documents/"),
  filename:    (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const phaseDocumentUpload = multer({ storage: phaseDocumentStorage, limits: { fileSize: 20 * 1024 * 1024 } });
route.post("/student/phase-documents", authenticate, authorize("student"), phaseDocumentUpload.single("document"), uploadDocument);
route.get("/phase-documents", authenticate, getDocuments);
route.get("/student/phase-documents/:teamId", authenticate, getTeamDocuments);

// ─────────────────────────────────────────────
// ✅ MEETING ATTENDANCE (Present/Late/Absent per student, per meeting)
// ─────────────────────────────────────────────
const {
  markAttendance,
  getMyAttendance,
  getAttendanceSummary,
} = require("../Controllers/AttendanceController");
route.put("/faculty/meetings/:meetingId/attendance", authenticate, authorize("supervisor"), markAttendance);
route.get("/student/my-attendance", authenticate, authorize("student"), getMyAttendance);
route.get("/admin/attendance-summary", authenticate, authorize("admin"), getAttendanceSummary);

// ─────────────────────────────────────────────
// 🔑 PASSWORD RESET REQUESTS (manual admin-resolved queue, supplementary to
// the email-token forgot/reset-password flow above)
// ─────────────────────────────────────────────
const {
  createRequest,
  getAllRequests,
  resolveRequest,
} = require("../Controllers/PasswordResetRequestController");
route.post("/password-reset-requests", createRequest);
route.get("/admin/password-reset-requests", authenticate, authorize("admin"), getAllRequests);
route.put("/admin/password-reset-requests/:id/resolve", authenticate, authorize("admin"), resolveRequest);

// ─────────────────────────────────────────────
// ⚙️ SYSTEM SETTINGS (currently: group-formation on/off switch)
// ─────────────────────────────────────────────
const { getSettings, updateSettings } = require("../Controllers/SettingsController");
route.get("/settings", authenticate, getSettings);
route.put("/admin/settings", authenticate, authorize("admin"), updateSettings);

// ─────────────────────────────────────────────
// 📈 REPORTS (printable/exportable — Print via jsPDF client-side, Export via CSV client-side)
// ─────────────────────────────────────────────
const { getStudentsReport, getMarksReport } = require("../Controllers/ReportsController");
route.get("/admin/reports/students", authenticate, authorize("admin"), getStudentsReport);
route.get("/admin/reports/marks", authenticate, authorize("admin"), getMarksReport);

// ─────────────────────────────────────────────
// 🕵️ GROUP TRACKING (full per-group FYP history, admin only)
// ─────────────────────────────────────────────
const { getAllGroupsSummary, getGroupHistory } = require("../Controllers/GroupTrackingController");
route.get("/admin/group-tracking", authenticate, authorize("admin"), getAllGroupsSummary);
route.get("/admin/group-tracking/:teamId", authenticate, authorize("admin"), getGroupHistory);

module.exports = route;
