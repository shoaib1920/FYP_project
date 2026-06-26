const Proposal = require("../Models/Proposal");
const Project = require("../Models/Project");

const letterGrade = (marks) =>
  marks >= 80 ? "A" : marks >= 70 ? "B" : marks >= 60 ? "C" : marks >= 50 ? "D" : "F";

// GET /admin/analytics — system-wide aggregates for the admin dashboard.
// Computed in JS rather than Mongo aggregation pipelines: this app's data
// volume is small (academic-department scale), so the simpler, easier-to-
// verify approach is the right tradeoff over pipeline complexity.
exports.getAnalytics = async (req, res) => {
  try {
    const [proposals, projects] = await Promise.all([
      Proposal.find().select("status departmentId submittedAt approvedAt").lean(),
      Project.find()
        .populate("supervisorId", "name")
        .populate("departmentId", "name")
        .select("status gradesStatus evaluationMarks memberGrades supervisorId departmentId")
        .lean(),
    ]);

    // ── Proposal funnel ──
    const proposalFunnel = {};
    proposals.forEach((p) => {
      proposalFunnel[p.status] = (proposalFunnel[p.status] || 0) + 1;
    });

    // ── Average admin turnaround time (submission → admin decision) ──
    const turnaroundDays = proposals
      .filter((p) => p.approvedAt)
      .map((p) => (new Date(p.approvedAt) - new Date(p.submittedAt)) / (1000 * 60 * 60 * 24));
    const avgTurnaroundDays = turnaroundDays.length
      ? Number((turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length).toFixed(1))
      : null;

    // ── Supervisor workload ──
    const workloadMap = new Map();
    projects.forEach((p) => {
      if (!p.supervisorId) return;
      const key = String(p.supervisorId._id);
      if (!workloadMap.has(key)) workloadMap.set(key, { name: p.supervisorId.name, count: 0 });
      workloadMap.get(key).count += 1;
    });
    const supervisorWorkload = Array.from(workloadMap.values()).sort((a, b) => b.count - a.count);

    // ── Department performance (avg grade among released projects) + grade distribution ──
    const deptMap = new Map();
    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    let totalGradedStudents = 0;
    let marksSum = 0;

    projects.forEach((p) => {
      if (p.gradesStatus !== "RELEASED") return;
      const deptName = p.departmentId?.name || "Unassigned";
      if (!deptMap.has(deptName)) deptMap.set(deptName, { name: deptName, totalMarks: 0, count: 0 });
      const entry = deptMap.get(deptName);

      const grades = p.memberGrades?.length
        ? p.memberGrades.map((g) => g.marks)
        : [p.evaluationMarks ?? 0];

      grades.forEach((marks) => {
        entry.totalMarks += marks;
        entry.count += 1;
        marksSum += marks;
        totalGradedStudents += 1;
        gradeDistribution[letterGrade(marks)] += 1;
      });
    });

    const departmentPerformance = Array.from(deptMap.values()).map((d) => ({
      name: d.name,
      averageMarks: d.count ? Number((d.totalMarks / d.count).toFixed(1)) : 0,
      studentsGraded: d.count,
    }));

    const overallAverageMarks = totalGradedStudents
      ? Number((marksSum / totalGradedStudents).toFixed(1))
      : null;

    // ── Project status breakdown ──
    const projectStatusBreakdown = {};
    projects.forEach((p) => {
      projectStatusBreakdown[p.status] = (projectStatusBreakdown[p.status] || 0) + 1;
    });

    res.json({
      success: true,
      proposalFunnel,
      avgTurnaroundDays,
      supervisorWorkload,
      departmentPerformance,
      gradeDistribution,
      overallAverageMarks,
      totalGradedStudents,
      projectStatusBreakdown,
      totals: { proposals: proposals.length, projects: projects.length },
    });
  } catch (err) {
    console.error("Error computing analytics:", err);
    res.status(500).json({ message: "Server error while computing analytics" });
  }
};
