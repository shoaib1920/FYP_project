const mongoose = require("mongoose");
const Project = require("../Models/Project");
const Proposal = require("../Models/Proposal");
const ProgressLog = require("../Models/ProgressLog");
const ProjectReviewNote = require("../Models/ProjectReviewNote");
const MeetingLog = require("../Models/MeetingLog");
const Template = require("../Models/Template");
const Admin = require("../Models/Admin/AdminAuth");

// Is this user allowed to view this project's document center — the student
// team, the assigned supervisor, or any admin (mirrors access rules already
// enforced elsewhere for this project, just centralized here since this
// endpoint reads across five different collections at once).
const canViewProjectDocuments = async (userId, project) => {
  const team = project.teamId;
  const isTeamMember =
    team && ((team.members || []).some((m) => String(m) === String(userId)) || String(team.createdBy) === String(userId));
  if (isTeamMember) return true;

  if (String(project.supervisorId) === String(userId)) return true;

  return !!(await Admin.findById(userId).select("_id").lean());
};

// GET /projects/:projectId/documents — a read-only, single-screen aggregation
// of every document/record tied to this project (proposal + its revision
// history, progress logs, final report + AI check + rejection history,
// live-review batches, meeting minutes, project-specific templates) — these
// previously only existed scattered one-at-a-time across five separate
// modules with no consolidated view.
exports.getProjectDocuments = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project ID" });
    }

    const project = await Project.findById(projectId).populate("teamId", "members createdBy");
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const allowed = await canViewProjectDocuments(userId, project);
    if (!allowed) {
      return res.status(403).json({ success: false, message: "You don't have access to this project's documents" });
    }

    const [proposal, progressLogs, reviewNotes, meetings, templates] = await Promise.all([
      Proposal.findById(project.proposalId).select("proposalReportUrl revisions title"),
      ProgressLog.find({ projectId }).sort({ weekNumber: 1 }),
      ProjectReviewNote.find({ projectId }).sort({ createdAt: -1 }),
      MeetingLog.find({ projectId }).sort({ scheduledAt: -1 }),
      Template.find({ fypProjectId: projectId }).sort({ createdAt: -1 }),
    ]);

    res.json({
      success: true,
      documents: {
        proposal: proposal
          ? {
              currentUrl: proposal.proposalReportUrl,
              revisions: (proposal.revisions || []).map((r) => ({
                proposalReportUrl: r.proposalReportUrl,
                title: r.title,
                revisedAt: r.revisedAt,
              })),
            }
          : null,
        progressLogs: progressLogs.map((p) => ({
          weekNumber: p.weekNumber,
          workDone: p.workDone,
          plannedNext: p.plannedNext,
          challenges: p.challenges,
          status: p.status,
          supervisorFeedback: p.supervisorFeedback,
          submittedAt: p.createdAt,
        })),
        finalReport: {
          url: project.finalReportUrl || null,
          status: project.finalReportUrl ? "SUBMITTED" : project.finalReportRejection?.reason ? "REJECTED" : "NOT_SUBMITTED",
          reportQualityCheck: project.reportQualityCheck || null,
          rejection: project.finalReportRejection?.reason ? project.finalReportRejection : null,
        },
        reviewNotes: reviewNotes.map((n) => ({
          _id: n._id,
          items: n.items,
          remarks: n.remarks,
          status: n.status,
          createdAt: n.createdAt,
          resolvedAt: n.resolvedAt,
        })),
        meetings: meetings.map((m) => ({
          _id: m._id,
          scheduledAt: m.scheduledAt,
          agenda: m.agenda,
          minutesOfMeeting: m.minutesOfMeeting,
          status: m.status,
        })),
        templates: templates.map((t) => ({
          _id: t._id,
          title: t.title,
          category: t.category,
          fileUrl: t.fileUrl,
          uploadedByName: t.uploadedByName,
          createdAt: t.createdAt,
        })),
      },
    });
  } catch (err) {
    console.error("Error fetching project documents:", err);
    res.status(500).json({ success: false, message: "Server error while fetching project documents" });
  }
};
