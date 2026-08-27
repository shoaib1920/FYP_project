// Seeds a few departments/sessions/students/supervisors/teams so the new
// evaluation-phase screens aren't empty during manual testing. Run this
// WHILE `npm run dev:local` is already up (same fixed local Mongo instance,
// port 27117) — never point this at production data.
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Department = require("../Models/Department");
const AcademicSession = require("../Models/AcademicSession");
const Users = require("../Models/Users");
const Supervisor = require("../Models/supervisorModel");
const Admin = require("../Models/Admin_Auth");
const Team = require("../Models/Team");
const EvaluationPanel = require("../Models/EvaluationPanel");
const EvaluationPhase = require("../Models/EvaluationPhase");

(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27117/FYP_DB");
  console.log("Connected to local dev DB");

  const passwordHash = await bcrypt.hash("password123", 10);

  let dept = await Department.findOne({ code: "CS" });
  if (!dept) {
    dept = await Department.create({
      name: "Computer Science",
      code: "CS",
      academicSession: "2022-2026",
      studentJoinCode: "CS-STU-DEV1",
      supervisorJoinCode: "CS-SUP-DEV1",
    });
    console.log("Created department: Computer Science");
  }

  let session = await AcademicSession.findOne({ name: "2022-2026" });
  if (!session) {
    session = await AcademicSession.create({ name: "2022-2026" });
    console.log("Created session: 2022-2026");
  }

  let admin = await Admin.findOne({ username: "admin.dev" });
  if (!admin) {
    admin = await Admin.create({ username: "admin.dev", password: "password123" }); // hashed by the model's pre-save hook
    console.log("Created admin: admin.dev / password123");
  }

  let supervisor = await Supervisor.findOne({ email: "supervisor.dev@example.com" });
  if (!supervisor) {
    supervisor = await Supervisor.create({
      name: "Dr. Dev Supervisor",
      email: "supervisor.dev@example.com",
      password: passwordHash,
      department: dept._id,
      employeeId: "EMP-DEV1",
      isEmailVerified: true,
    });
    console.log("Created supervisor: supervisor.dev@example.com / password123");
  }

  const studentDefs = [
    { name: "Dev Student One", email: "student1.dev@example.com", studentId: "DEV-STU-001" },
    { name: "Dev Student Two", email: "student2.dev@example.com", studentId: "DEV-STU-002" },
  ];
  const students = [];
  for (const def of studentDefs) {
    let student = await Users.findOne({ email: def.email });
    if (!student) {
      student = await Users.create({ ...def, password: passwordHash, department: dept._id, isEmailVerified: true });
      console.log(`Created student: ${def.email} / password123`);
    }
    students.push(student);
  }

  let team = await Team.findOne({ subject: "Dev Test Project" });
  if (!team) {
    team = await Team.create({
      subject: "Dev Test Project",
      createdBy: students[0]._id,
      creatorName: students[0].name,
      members: students.map((s) => s._id),
      memberNames: students.map((s) => s.name),
      creatorJoinCode: "CS-STU-DEV1",
      department: dept.name,
    });
    console.log("Created team: Dev Test Project");
  }

  let panel = await EvaluationPanel.findOne({ name: "Dev Panel" });
  if (!panel) {
    panel = await EvaluationPanel.create({ name: "Dev Panel", members: [supervisor._id] });
    console.log("Created evaluation panel: Dev Panel");
  }

  let phase = await EvaluationPhase.findOne({ name: "Proposal Defence" });
  if (!phase) {
    phase = await EvaluationPhase.create({
      name: "Proposal Defence",
      totalMarks: 20,
      convertToMarks: 10,
      panelId: panel._id,
      criteria: [{ name: "Clarity", maxMarks: 10 }, { name: "Feasibility", maxMarks: 10 }],
    });
    console.log("Created evaluation phase: Proposal Defence");
  }

  console.log("\nSeed complete. Log in with:");
  console.log("  Admin:      admin.dev / password123");
  console.log("  Supervisor: supervisor.dev@example.com / password123");
  console.log("  Student:    student1.dev@example.com / password123");

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
