const MeetingLog = require("../Models/MeetingLog");
const Project = require("../Models/Project");
const { createNotification } = require("../utils/notify");

// POST /meetings
// Supervisor schedules a meeting
exports.scheduleMeeting = async (req, res) => {
  try {
    const supervisorId = req.user._id;
    const { projectId, scheduledAt, agenda, attendees, nextMeetingDate } = req.body;

    if (!projectId || !scheduledAt) {
      return res.status(400).json({ message: "projectId and scheduledAt are required" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (String(project.supervisorId) !== String(supervisorId)) {
      return res.status(403).json({ message: "Only the assigned supervisor can schedule meetings" });
    }

    const meeting = await MeetingLog.create({
      projectId,
      teamId: project.teamId,
      supervisorId,
      scheduledAt: new Date(scheduledAt),
      agenda: agenda || "",
      attendees: attendees || [],
      nextMeetingDate: nextMeetingDate ? new Date(nextMeetingDate) : null,
      status: "SCHEDULED",
    });

    await createNotification({
      userId: project.teamLeaderId,
      title: "Meeting Scheduled",
      message: `Your supervisor has scheduled a meeting for "${project.title}" on ${new Date(scheduledAt).toLocaleDateString()}.`,
      relatedType: "project",
      relatedId: project._id,
    });

    res.status(201).json({ success: true, meeting });
  } catch (err) {
    console.error("Error scheduling meeting:", err);
    res.status(500).json({ message: "Server error while scheduling meeting" });
  }
};

// GET /meetings/:projectId
// Get all meetings for a project
exports.getProjectMeetings = async (req, res) => {
  try {
    const { projectId } = req.params;

    const meetings = await MeetingLog.find({ projectId })
      .populate("supervisorId", "name email")
      .populate("attendees", "name email")
      .sort({ scheduledAt: -1 });

    res.json({ success: true, meetings });
  } catch (err) {
    console.error("Error fetching meetings:", err);
    res.status(500).json({ message: "Server error while fetching meetings" });
  }
};

// PUT /meetings/:meetingId/minutes
// Supervisor adds minutes after the meeting
exports.updateMeetingMinutes = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const supervisorId = req.user._id;
    const { minutesOfMeeting, nextMeetingDate } = req.body;

    if (!minutesOfMeeting) {
      return res.status(400).json({ message: "minutesOfMeeting is required" });
    }

    const meeting = await MeetingLog.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (String(meeting.supervisorId) !== String(supervisorId)) {
      return res.status(403).json({ message: "Only the meeting supervisor can add minutes" });
    }

    meeting.minutesOfMeeting = minutesOfMeeting;
    meeting.status = "COMPLETED";
    if (nextMeetingDate) meeting.nextMeetingDate = new Date(nextMeetingDate);

    await meeting.save();

    const project = await Project.findById(meeting.projectId);
    if (project) {
      await createNotification({
        userId: project.teamLeaderId,
        title: "Meeting Minutes Added",
        message: `Minutes for your meeting on "${project.title}" have been recorded.`,
        relatedType: "project",
        relatedId: project._id,
      });
    }

    res.json({ success: true, meeting });
  } catch (err) {
    console.error("Error updating meeting minutes:", err);
    res.status(500).json({ message: "Server error while updating meeting minutes" });
  }
};

// PUT /meetings/:meetingId/status
// Update meeting status (CANCELLED etc.)
exports.updateMeetingStatus = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const supervisorId = req.user._id;
    const { status } = req.body;

    const allowed = ["SCHEDULED", "COMPLETED", "CANCELLED"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowed.join(", ")}` });
    }

    const meeting = await MeetingLog.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (String(meeting.supervisorId) !== String(supervisorId)) {
      return res.status(403).json({ message: "Only the meeting supervisor can update status" });
    }

    meeting.status = status;
    await meeting.save();

    res.json({ success: true, meeting });
  } catch (err) {
    console.error("Error updating meeting status:", err);
    res.status(500).json({ message: "Server error while updating meeting status" });
  }
};
