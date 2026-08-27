const MeetingLog = require("../Models/MeetingLog");
const Team = require("../Models/Team");
const Project = require("../Models/Project");

// PUT /faculty/meetings/:meetingId/attendance — supervisor marks Present/Late/Absent
// Body: { records: [{ studentId, status }] }
exports.markAttendance = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: "records[] is required" });
    }

    const meeting = await MeetingLog.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ success: false, message: "Meeting not found" });
    if (String(meeting.supervisorId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Only the meeting's supervisor can mark attendance" });
    }

    meeting.attendanceRecords = records.map((r) => ({ student: r.studentId, status: r.status }));
    if (meeting.status === "SCHEDULED") meeting.status = "COMPLETED";
    await meeting.save();

    res.json({ success: true, meeting });
  } catch (err) {
    console.error("Error marking attendance:", err);
    res.status(500).json({ success: false, message: "Server error while marking attendance" });
  }
};

// GET /student/my-attendance — the logged-in student's own attendance record
exports.getMyAttendance = async (req, res) => {
  try {
    const meetings = await MeetingLog.find({ attendees: req.user._id })
      .select("projectId scheduledAt agenda attendanceRecords")
      .sort({ scheduledAt: -1 });

    const records = meetings.map((m) => {
      const entry = m.attendanceRecords.find((r) => String(r.student) === String(req.user._id));
      return {
        meetingId: m._id,
        scheduledAt: m.scheduledAt,
        agenda: m.agenda,
        status: entry ? entry.status : null,
      };
    });

    res.json({ success: true, attendance: records });
  } catch (err) {
    console.error("Error fetching my attendance:", err);
    res.status(500).json({ success: false, message: "Server error while fetching attendance" });
  }
};

// GET /admin/attendance-summary — filterable ?departmentId=&academicSession=&shift=
exports.getAttendanceSummary = async (req, res) => {
  try {
    const teamFilter = {};
    if (req.query.departmentId) teamFilter.department = req.query.departmentId;
    if (req.query.academicSession) teamFilter.academicSession = req.query.academicSession;

    const teams = await Team.find(teamFilter).populate("members", "name email");

    const summary = await Promise.all(
      teams.map(async (team) => {
        const meetings = await MeetingLog.find({ teamId: team._id });
        const students = team.members.map((student) => {
          let present = 0, absent = 0, late = 0, total = 0;
          meetings.forEach((m) => {
            const entry = m.attendanceRecords.find((r) => String(r.student) === String(student._id));
            if (entry) {
              total += 1;
              if (entry.status === "PRESENT") present += 1;
              else if (entry.status === "ABSENT") absent += 1;
              else if (entry.status === "LATE") late += 1;
            }
          });
          const percent = total > 0 ? Math.round(((present + late) / total) * 100) : null;
          return { studentId: student._id, name: student.name, email: student.email, present, absent, late, total, percent };
        });

        return {
          teamId: team._id,
          subject: team.subject,
          department: team.department,
          meetingCount: meetings.length,
          students,
        };
      })
    );

    res.json({ success: true, summary });
  } catch (err) {
    console.error("Error fetching attendance summary:", err);
    res.status(500).json({ success: false, message: "Server error while fetching attendance summary" });
  }
};
