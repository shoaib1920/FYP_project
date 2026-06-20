const Department = require("../Models/Department");
const Supervisor = require("../Models/supervisorModel");
const AssignedProject = require("../Models/SupervisorModels/AssignedProject");
const Proposal = require("../Models/Proposal");
const Project = require("../Models/Project");
const Team = require("../Models/Team");
const mongoose = require("mongoose");

// ✅ Generate random alphanumeric code (e.g., 4WKL, 8JQ2)
const generateRandomCode = (length = 4) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};




// ✅ Generate student join code (e.g., CS-STU-4WKL)
const generateStudentJoinCode = (deptCode) => {
  return `${deptCode}-STU-${generateRandomCode(4)}`;
};

// ✅ Generate supervisor join code (e.g., CS-SUP-8JQ2)
const generateSupervisorJoinCode = (deptCode) => {
  return `${deptCode}-SUP-${generateRandomCode(4)}`;
};

// ✅ Create Department
exports.createDepartment = async (req, res) => {
  try {
    const { name, code, academicSession, description } = req.body;

    // Validate required fields
    if (!name || !code || !academicSession) {
      return res.status(400).json({
        message: "Department name, code, and academic session are required.",
      });
    }

    // Check if department already exists
    const existingDept = await Department.findOne({
      $or: [{ name }, { code: code.toUpperCase() }],
    });

    if (existingDept) {
      return res.status(400).json({
        message: "Department with this name or code already exists.",
      });
    }

    // Generate join codes
    const deptCode = code.toUpperCase();
    const studentJoinCode = generateStudentJoinCode(deptCode);
    const supervisorJoinCode = generateSupervisorJoinCode(deptCode);

    // Create department
    const department = new Department({
      name,
      code: deptCode,
      academicSession,
      description,
      studentJoinCode,
      supervisorJoinCode,
    });

    await department.save();

    res.status(201).json({
      message: "Department created successfully.",
      department,
    });
  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({
      message: "Error creating department.",
      error: error.message,
    });
  }
};

// ✅ Get All Departments
exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ createdAt: -1 });
    res.status(200).json({
      message: "Departments fetched successfully.",
      departments,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      message: "Error fetching departments.",
      error: error.message,
    });
  }
};

// ✅ Get Department by ID
exports.getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id);

    if (!department) {
      return res.status(404).json({
        message: "Department not found.",
      });
    }

    res.status(200).json({
      message: "Department fetched successfully.",
      department,
    });
  } catch (error) {
    console.error("Error fetching department:", error);
    res.status(500).json({
      message: "Error fetching department.",
      error: error.message,
    });
  }
};

// ✅ Update Department
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, academicSession, description, isActive } = req.body;

    const department = await Department.findById(id);

    if (!department) {
      return res.status(404).json({
        message: "Department not found.",
      });
    }

    // Check if new name or code already exists (excluding current department)
    if (name && name !== department.name) {
      const existingName = await Department.findOne({ name });
      if (existingName) {
        return res.status(400).json({
          message: "A department with this name already exists.",
        });
      }
      department.name = name;
    }

    if (code && code.toUpperCase() !== department.code) {
      const existingCode = await Department.findOne({
        code: code.toUpperCase(),
      });
      if (existingCode) {
        return res.status(400).json({
          message: "A department with this code already exists.",
        });
      }
      department.code = code.toUpperCase();
    }

    if (academicSession) department.academicSession = academicSession;
    if (description !== undefined) department.description = description;
    if (isActive !== undefined) department.isActive = isActive;

    department.updatedAt = new Date();
    await department.save();

    res.status(200).json({
      message: "Department updated successfully.",
      department,
    });
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({
      message: "Error updating department.",
      error: error.message,
    });
  }
};

// ✅ Delete Department
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findByIdAndDelete(id);

    if (!department) {
      return res.status(404).json({
        message: "Department not found.",
      });
    }

    res.status(200).json({
      message: "Department deleted successfully.",
      department,
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({
      message: "Error deleting department.",
      error: error.message,
    });
  }
};

// ✅ Verify Join Code (Student)
exports.verifyStudentJoinCode = async (req, res) => {
  try {
    const { joinCode } = req.body;

    if (!joinCode) {
      return res.status(400).json({
        message: "Join code is required.",
      });
    }

    const department = await Department.findOne({
      studentJoinCode: joinCode.toUpperCase(),
      isActive: true,
    });

    if (!department) {
      return res.status(404).json({
        message: "Invalid or expired student join code.",
      });
    }

    res.status(200).json({
      message: "Join code verified successfully.",
      department: {
        _id: department._id,
        name: department.name,
        code: department.code,
        academicSession: department.academicSession,
      },
    });
  } catch (error) {
    console.error("Error verifying student join code:", error);
    res.status(500).json({
      message: "Error verifying join code.",
      error: error.message,
    });
  }
};

// ✅ Verify Join Code (Supervisor)
exports.verifySupervisorJoinCode = async (req, res) => {
  try {
    const { joinCode } = req.body;

    if (!joinCode) {
      return res.status(400).json({
        message: "Join code is required.",
      });
    }

    const department = await Department.findOne({
      supervisorJoinCode: joinCode.toUpperCase(),
      isActive: true,
    });

    if (!department) {
      return res.status(404).json({
        message: "Invalid or expired supervisor join code.",
      });
    }

    res.status(200).json({
      message: "Join code verified successfully.",
      department: {
        _id: department._id,
        name: department.name,
        code: department.code,
        academicSession: department.academicSession,
      },
    });
  } catch (error) {
    console.error("Error verifying supervisor join code:", error);
    res.status(500).json({
      message: "Error verifying join code.",
      error: error.message,
    });
  }
};

// ✅ Regenerate Student Join Code
exports.regenerateStudentJoinCode = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id);

    if (!department) {
      return res.status(404).json({
        message: "Department not found.",
      });
    }

    const newStudentJoinCode = generateStudentJoinCode(department.code);
    department.studentJoinCode = newStudentJoinCode;
    await department.save();

    res.status(200).json({
      message: "Student join code regenerated successfully.",
      department,
    });
  } catch (error) {
    console.error("Error regenerating student join code:", error);
    res.status(500).json({
      message: "Error regenerating join code.",
      error: error.message,
    });
  }
};

// ✅ Regenerate Supervisor Join Code
exports.regenerateSupervisorJoinCode = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id);

    if (!department) {
      return res.status(404).json({
        message: "Department not found.",
      });
    }

    const newSupervisorJoinCode = generateSupervisorJoinCode(department.code);
    department.supervisorJoinCode = newSupervisorJoinCode;
    await department.save();

    res.status(200).json({
      message: "Supervisor join code regenerated successfully.",
      department,
    });
  } catch (error) {
    console.error("Error regenerating supervisor join code:", error);
    res.status(500).json({
      message: "Error regenerating join code.",
      error: error.message,
    });
  }
};

// ✅ Get Department Statistics
exports.getDepartmentStats = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id);

    if (!department) {
      return res.status(404).json({
        message: "Department not found.",
      });
    }

    res.status(200).json({
      message: "Department statistics fetched successfully.",
      stats: {
        departmentId: department._id,
        departmentName: department.name,
        departmentCode: department.code,
        academicSession: department.academicSession,
        totalStudents: department.totalStudents,
        totalSupervisors: department.totalSupervisors,
        totalTeams: department.totalTeams,
        totalProjects: department.totalProjects,
      },
    });
  } catch (error) {
    console.error("Error fetching department statistics:", error);
    res.status(500).json({
      message: "Error fetching statistics.",
      error: error.message,
    });
  }
};

// ✅ Get User's Department Information
exports.getUserDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;

    if (!departmentId) {
      return res.status(400).json({
        message: "Department ID is required.",
      });
    }

    const department = await Department.findById(departmentId);

    if (!department) {
      return res.status(404).json({
        message: "Department not found.",
      });
    }

    res.status(200).json({
      message: "Department information fetched successfully.",
      department: {
        _id: department._id,
        name: department.name,
        code: department.code,
        academicSession: department.academicSession,
        description: department.description,
        isActive: department.isActive,
        totalStudents: department.totalStudents,
        totalSupervisors: department.totalSupervisors,
        totalTeams: department.totalTeams,
        totalProjects: department.totalProjects,
      },
    });
  } catch (error) {
    console.error("Error fetching user department:", error);
    res.status(500).json({
      message: "Error fetching department information.",
      error: error.message,
    });
  }
};

// ✅ Get Departments for a Supervisor
exports.getSupervisorDepartments = async (req, res) => {
  try {
    const supervisorId = req.user._id;

    const [projectAssignments, proposals] = await Promise.all([
      AssignedProject.find({ supervisorId }).populate({
        path: "groupId",
        select: "department",
      }),
      Proposal.find({ assignedSupervisorId: supervisorId }).populate({
        path: "teamId",
        select: "department",
      }),
    ]);

    const departmentValues = new Set();

    projectAssignments.forEach((assignment) => {
      const department = assignment.groupId?.department;
      if (department) {
        departmentValues.add(String(department).trim());
      }
    });

    proposals.forEach((proposal) => {
      const department = proposal.teamId?.department;
      if (department) {
        departmentValues.add(String(department).trim());
      }
    });

    if (departmentValues.size === 0) {
      return res.status(200).json({
        message: "No departments found for supervised teams.",
        departments: [],
      });
    }

    const values = Array.from(departmentValues);
    const departmentQuery = values.flatMap((value) => {
      const conditions = [{ name: value }, { code: value }];
      if (mongoose.Types.ObjectId.isValid(value)) {
        conditions.push({ _id: value });
      }
      return conditions;
    });

    const departments = await Department.find({ $or: departmentQuery }).lean();
    const matchedValues = new Set();
    departments.forEach((dept) => {
      matchedValues.add(String(dept._id));
      matchedValues.add(String(dept.name));
      matchedValues.add(String(dept.code));
    });

    const fallbackDepartments = values
      .filter((value) => !matchedValues.has(value))
      .map((value) => ({
        _id: null,
        name: value,
        code: value,
        academicSession: null,
        description: "Department referenced by supervised team",
        isActive: null,
        totalStudents: null,
        totalSupervisors: null,
        totalTeams: null,
        totalProjects: null,
        studentJoinCode: null,
        supervisorJoinCode: null,
      }));

    res.status(200).json({
      message: "Supervisor departments fetched successfully.",
      departments: [...departments, ...fallbackDepartments],
    });
  } catch (error) {
    console.error("Error fetching supervisor departments:", error);
    res.status(500).json({
      message: "Error fetching supervisor departments.",
      error: error.message,
    });
  }
};

// ✅ Get Supervisor's Department Overview (home dept + all supervised depts)
exports.getMyDepartment = async (req, res) => {
  try {
    const supervisorId = req.user._id;

    // 1. Supervisor profile with home department populated
    const supervisor = await Supervisor.findById(supervisorId)
      .select("name email designation department employeeId")
      .populate("department");

    if (!supervisor) {
      return res.status(404).json({ message: "Supervisor not found." });
    }

    // `Department.totalTeams` is a denormalized counter that is never incremented
    // when a team is created, so it's always stale (usually 0). Count live instead.
    let homeDepartment = supervisor.department;
    if (homeDepartment) {
      const liveTeamCount = await Team.countDocuments({ department: homeDepartment.name });
      homeDepartment = { ...homeDepartment.toObject(), totalTeams: liveTeamCount };
    }

    // 2. All FYP projects this supervisor is supervising, with department + team info
    const allProjects = await Project.find({ supervisorId })
      .select("title status gradesStatus createdAt departmentId teamId")
      .populate("departmentId", "name code academicSession isActive totalStudents totalSupervisors totalTeams totalProjects studentJoinCode supervisorJoinCode description")
      .populate("teamId", "subject department")
      .sort({ createdAt: -1 });

    // 3. Group projects by department
    const deptMap = new Map();

    allProjects.forEach((p) => {
      let key, deptData;

      if (p.departmentId && p.departmentId._id) {
        key = String(p.departmentId._id);
        deptData = p.departmentId;
      } else {
        // fallback: use team.department string as key
        const fallbackName = p.teamId?.department || "Unknown Department";
        key = `fallback_${fallbackName}`;
        deptData = { _id: null, name: fallbackName, code: fallbackName, academicSession: "—", isActive: null };
      }

      if (!deptMap.has(key)) {
        deptMap.set(key, { department: deptData, projects: [] });
      }
      deptMap.get(key).projects.push({
        _id: p._id,
        title: p.title,
        status: p.status,
        gradesStatus: p.gradesStatus,
        teamSubject: p.teamId?.subject || "",
        createdAt: p.createdAt,
      });
    });

    const supervisedDepartments = Array.from(deptMap.values());

    res.status(200).json({
      supervisor: {
        name: supervisor.name,
        email: supervisor.email,
        designation: supervisor.designation,
        employeeId: supervisor.employeeId,
      },
      homeDepartment: homeDepartment || null,
      supervisedDepartments,
      totalProjects: allProjects.length,
    });
  } catch (error) {
    console.error("Error fetching supervisor department overview:", error);
    res.status(500).json({ message: "Error fetching department overview.", error: error.message });
  }
};
