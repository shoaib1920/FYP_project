const Users = require("../Models/Users");
const Team = require("../Models/Team");
const Proposal = require("../Models/Proposal");
const Project = require("../Models/Project");
const PhaseMark = require("../Models/PhaseMark");

// GET /admin/reports/students — filterable by ?departmentId=
exports.getStudentsReport = async (req, res) => {
  try {
    const filter = {};
    if (req.query.departmentId) filter.department = req.query.departmentId;

    const students = await Users.find(filter).populate("department", "name code").sort({ name: 1 });
    const teams = await Team.find({ members: { $in: students.map((s) => s._id) } });

    const rows = await Promise.all(
      students.map(async (student) => {
        const team = teams.find((t) => t.members.some((m) => String(m) === String(student._id)));
        let groupCode = null, supervisorName = null, status = "No Group", academicSession = null;

        if (team) {
          groupCode = team.subject;
          const project = await Project.findOne({ teamId: team._id }).populate("supervisorId", "name");
          if (project) {
            supervisorName = project.supervisorId?.name || null;
            status = project.status;
            academicSession = project.academicSession;
          } else {
            const proposal = await Proposal.findOne({ teamId: team._id }).sort({ createdAt: -1 });
            if (proposal) {
              status = proposal.status;
              academicSession = proposal.academicSession;
            }
          }
        }

        return {
          studentId: student.studentId,
          name: student.name,
          email: student.email,
          department: student.department?.name || null,
          academicSession,
          groupCode,
          supervisorName,
          status,
        };
      })
    );

    if (req.query.academicSession) {
      return res.json({ success: true, students: rows.filter((r) => r.academicSession === req.query.academicSession) });
    }

    res.json({ success: true, students: rows });
  } catch (err) {
    console.error("Error building students report:", err);
    res.status(500).json({ success: false, message: "Server error while building students report" });
  }
};

// GET /admin/reports/marks — filterable by ?phaseId=&departmentId=
exports.getMarksReport = async (req, res) => {
  try {
    let marks = await PhaseMark.find()
      .populate("studentId", "name studentId department")
      .populate("evaluatorId", "name")
      .populate({ path: "phaseScheduleId", populate: [{ path: "phaseId", select: "name totalMarks" }, { path: "teamId", select: "department" }] })
      .sort({ createdAt: -1 });

    if (req.query.phaseId) {
      marks = marks.filter((m) => String(m.phaseScheduleId?.phaseId?._id) === req.query.phaseId);
    }
    if (req.query.departmentId) {
      marks = marks.filter((m) => String(m.phaseScheduleId?.teamId?.department) === req.query.departmentId);
    }

    const rows = marks.map((m) => ({
      studentId: m.studentId?.studentId,
      studentName: m.studentId?.name,
      phase: m.phaseScheduleId?.phaseId?.name,
      marksObtained: m.marksObtained,
      maxMarks: m.maxMarks,
      convertedMarks: m.convertedMarks,
      evaluator: m.evaluatorId?.name,
      status: m.status,
    }));

    res.json({ success: true, marks: rows });
  } catch (err) {
    console.error("Error building marks report:", err);
    res.status(500).json({ success: false, message: "Server error while building marks report" });
  }
};
