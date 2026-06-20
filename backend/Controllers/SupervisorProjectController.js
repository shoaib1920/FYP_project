// controllers/projectController.js
const Project =  require("../Models/SupervisorModels/Project");
const AssignedProject = require("../Models/SupervisorModels/AssignedProject");
const Team = require("../Models/Team");
const Supervisor = require("../Models/supervisorModel");
const Department = require("../Models/Department");
const mongoose = require("mongoose");





// Submit project controller: change status to 'approval'
exports.submitFinalProject = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedProject = await AssignedProject.findByIdAndUpdate(
      id,
      { status: 'approval' },
      { new: true }
    );

    if (!updatedProject) {
      return res.status(404).json({ message: 'Assigned project not found' });
    }

    res.status(200).json(updatedProject);
  } catch (error) {
    console.error("Error submitting project:", error);
    res.status(500).json({ message: "Server error while submitting project" });
  }
};

// GET /api/assigned-projects/stats/:supervisorId
exports.getSupervisorProjectStats = async (req, res) => {
  try {
    const { supervisorId } = req.params;

    const projects = await AssignedProject.find({ supervisorId });

    const pendingCount = projects.filter(p => p.status === 'pending').length;
    const completeCount = projects.filter(p => p.status === 'completed').length;

    res.status(200).json({
      total: projects.length,
      pending: pendingCount,
      complete: completeCount,
      projects
    });
  } catch (error) {
    console.error("Error fetching supervisor project stats:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// GET /auth/supervisors
exports.getAllSupervisors = async (req, res) => {
  try {
    const supervisors = await Supervisor.find({});
    res.status(200).json({ supervisors });
  } catch (error) {
    console.error("❌ Error fetching supervisors:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /admin/supervisors — full supervisor list with department populated (Admin management)
exports.getAllSupervisorsForAdmin = async (req, res) => {
  try {
    const supervisors = await Supervisor.find({})
      .select("-password")
      .populate("department", "name code")
      .sort({ createdAt: -1 });
    res.status(200).json({ supervisors });
  } catch (error) {
    console.error("Error fetching supervisors for admin:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /admin/supervisors/:id/status — activate/deactivate a supervisor
exports.updateSupervisorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Active", "Inactive"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'Active' or 'Inactive'" });
    }

    const supervisor = await Supervisor.findByIdAndUpdate(id, { status }, { new: true })
      .select("-password")
      .populate("department", "name code");

    if (!supervisor) {
      return res.status(404).json({ message: "Supervisor not found" });
    }

    res.status(200).json({
      message: `Supervisor ${status === "Active" ? "activated" : "deactivated"} successfully`,
      supervisor,
    });
  } catch (error) {
    console.error("Error updating supervisor status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /admin/supervisors/:id/department — reassign a supervisor to a different department
exports.updateSupervisorDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { departmentId } = req.body;

    if (!departmentId) {
      return res.status(400).json({ message: "departmentId is required" });
    }

    const supervisor = await Supervisor.findById(id);
    if (!supervisor) {
      return res.status(404).json({ message: "Supervisor not found" });
    }

    const newDepartment = await Department.findById(departmentId);
    if (!newDepartment) {
      return res.status(404).json({ message: "Department not found" });
    }

    const oldDepartmentId = supervisor.department ? String(supervisor.department) : null;

    supervisor.department = newDepartment._id;
    await supervisor.save();

    if (oldDepartmentId && oldDepartmentId !== String(newDepartment._id)) {
      await Department.findByIdAndUpdate(oldDepartmentId, { $inc: { totalSupervisors: -1 } });
    }
    if (oldDepartmentId !== String(newDepartment._id)) {
      await Department.findByIdAndUpdate(newDepartment._id, { $inc: { totalSupervisors: 1 } });
    }

    const populated = await Supervisor.findById(id).select("-password").populate("department", "name code");
    res.status(200).json({ message: "Supervisor department updated successfully", supervisor: populated });
  } catch (error) {
    console.error("Error updating supervisor department:", error);
    res.status(500).json({ message: "Server error" });
  }
};





// @desc    Create a new Project
// @route   POST /api/projects
// @access  Public
exports.createProject = async (req, res) => {
  try {
    
    const { title, description, deadline, supervisorId, supervisorName } = req.body;

    if (!title || !description || !deadline || !supervisorId || !supervisorName) {
      return res.status(400).json({ message: "All fields are required including supervisor details" });
    }

    const newProject = new Project({ 
      title, 
      description, 
      deadline,
      supervisorId,
      supervisorName,
    });

    await newProject.save();

    res.status(201).json({ message: "Project created successfully", project: newProject });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
exports.AssignedProjectList = async (req, res) => {
  try {
    const assignedProjects = await AssignedProject.find()
      .populate('projectId', 'title')
      .populate('teamId', 'subject')
      .populate('supervisorId', 'name')
      .sort({ assignedDate: -1 });

    res.status(200).json(assignedProjects);
  } catch (error) {
    console.error('Real error fetching assigned projects:', error); // 🔍 log actual error
    res.status(500).json({ message: 'Failed to fetch assigned projects', error: error.message });
  }
};


// @desc    Get all Projects
// @route   GET /api/projects
// @access  Public
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.status(200).json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Server Error" });
  }
};



// Assign Project
exports.assignProject = async (req, res) => {
  try {
    const { projectId, groupId, supervisorId } = req.body;

    if (!projectId || !groupId || !supervisorId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingAssignment = await AssignedProject.findOne({ projectId, groupId});

    if (existingAssignment ) {
      return res.status(400).json({ message: 'Project already assigned!' });
    }

    const assigned = new AssignedProject({ projectId, groupId, supervisorId });
    await assigned.save();

    res.status(201).json({ message: 'Project assigned successfully', assigned });
  } catch (error) {
    console.error("Error assigning project:", error);
    res.status(500).json({ message: 'Error assigning project', error: error.message });
  }
};


