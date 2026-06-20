const TaskAssignment = require("../Models/TaskAssignment");
const mongoose = require("mongoose");
const Task = require("../Models/Task");
const UserProjectSummary = require("../Models/UserProjectSummary");
const Teams = require("../Models/Team");
const AssignProject = require("../Models/SupervisorModels/AssignedProject");
const Project = require("../Models/SupervisorModels/Project");
const FYPProject = require("../Models/Project");

// ✅ Assign a Task
exports.assignTask = async (req, res) => {
  try {
    const { project, user, user_id, role, assignedBy, assignerJoinCode } = req.body;

    if (!project || !user || !user_id || !role || !assignedBy) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    const taskDetails = await Task.findById(project).lean();

    if (!taskDetails) {
      return res.status(404).json({ message: "Task not found for assignment" });
    }

    const projectDetails = taskDetails.projectId
      ? await Project.findById(taskDetails.projectId).lean()
      : null;

    // ✅ Create and save new TaskAssignment with task metadata
    const newTaskAssignment = new TaskAssignment({
      project,
      taskId: project,
      taskCode: taskDetails.taskCode,
      taskFile: taskDetails.taskFile,
      studentJoinCode: taskDetails.studentJoinCode,
      assignerJoinCode,
      department: projectDetails?.departmentId || null,
      description: taskDetails.description,
      user,
      user_id,
      role,
      assignedBy,
    });

    await newTaskAssignment.save();

    // ✅ Mark the task as assigned in Task table
    await Task.findByIdAndUpdate(project, { isAssigned: true });

    // ✅ Check if user summary already exists
    let userSummary = await UserProjectSummary.findOne({ userId: user_id });

    if (userSummary) {
      // Increment pendingProjects count
      userSummary.pendingProjects += 1;
      await userSummary.save();
    } else {
      // Create new summary
      await UserProjectSummary.create({
        userId: user_id,
        userName: user,
        completedProjects: 0,
        pendingProjects: 1,
      });
    }

    res.status(201).json({
      message: "Task assigned successfully and summary updated",
      task: newTaskAssignment,
    });
  } catch (error) {
    console.error("❌ Error assigning task:", error);
    res
      .status(500)
      .json({ message: "Error assigning task", error: error.message });
  }
};

exports.getProjectsByStudent = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find all teams where this user is a member OR the creator
    const userTeams = await Teams.find(
      { $or: [{ members: userId }, { createdBy: userId }] },
      "_id"
    );
    const teamIds = userTeams.map((t) => t._id);

    // Return projects where user is team leader OR belongs to the team
    const projects = await FYPProject.find({
      $or: [{ teamLeaderId: userId }, { teamId: { $in: teamIds } }],
    })
      .populate({ path: "supervisorId", select: "name email", model: "Supervisor" })
      .populate({ path: "teamId", select: "subject members", model: "Team" })
      .lean();

    res.status(200).json(projects);
  } catch (err) {
    console.error("Error in getProjectsByStudent:", err);
    res.status(500).json({ message: "Server error while fetching student projects" });
  }
};

exports.getMyAssignments = async (req, res) => {
  try {
    const { userId } = req.query; // ✅ Query parameter se `userId` le rahe hain

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // ✅ Find only assignments where `user_id` matches
    const assignments = await TaskAssignment.find({ user_id: userId }).populate(
      "user assignedBy department"
    );

    // ✅ Fetch project details
    const allProjects = await Task.find();

    const updatedAssignments = assignments.map((task) => {
      const projectDetails = allProjects.find(
        (proj) => proj._id.toString() === task.project.toString()
      );

      return {
        ...task._doc,
        projectTitle: projectDetails ? projectDetails.title : "Unknown Project",
        taskId: task.taskId || task.project,
        taskCode: task.taskCode || projectDetails?.taskCode,
        taskFile: task.taskFile || projectDetails?.taskFile,
        studentJoinCode: task.studentJoinCode || projectDetails?.studentJoinCode,
        assignerJoinCode: task.assignerJoinCode || null,
        department: task.department || null,
        description: task.description || projectDetails?.description,
        startDate: projectDetails?.startDate,
        dueDate: projectDetails?.dueDate,
        priority: projectDetails?.priority,
      };
    });

    res.status(200).json(updatedAssignments);
  } catch (error) {
    console.error("❌ Error fetching my assignments:", error);
    res.status(500).json({ message: "Error fetching my assignments", error });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { project, user, user_id, role, assignedBy, assignerJoinCode, department } = req.body;

    if (!project || !user || !user_id || !role || !assignedBy) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    const updateData = {
      project,
      user,
      user_id,
      role,
      assignedBy,
    };

    if (assignerJoinCode !== undefined) {
      updateData.assignerJoinCode = assignerJoinCode;
    }

    if (department !== undefined) {
      updateData.department = department;
    }

    const updatedTask = await TaskAssignment.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ message: "Task assignment not found!" });
    }

    res
      .status(200)
      .json({
        message: "Task assignment updated successfully",
        task: updatedTask,
      });
  } catch (error) {
    console.error("❌ Error updating task assignment:", error);
    res
      .status(500)
      .json({
        message: "Error updating task assignment",
        error: error.message,
      });
  }
};

exports.getOtherAssignments = async (req, res) => {
  try {
    const { userId } = req.query; // ✅ Query parameter se `userId` le rahe hain

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // ✅ Find only assignments where `user_id` matches
    const assignments = await TaskAssignment.find({}).populate(
      "user assignedBy department"
    );
    // console.log("otherAssignment>>>",assignments);

    // ✅ Fetch project details
    const allProjects = await Task.find();

    const updatedAssignments = assignments.map((task) => {
      const projectDetails = allProjects.find(
        (proj) => proj._id.toString() === task.project.toString()
      );

      return {
        ...task._doc,
        projectTitle: projectDetails ? projectDetails.title : "Unknown Project",
        taskId: task.taskId || task.project,
        taskCode: task.taskCode || projectDetails?.taskCode,
        taskFile: task.taskFile || projectDetails?.taskFile,
        studentJoinCode: task.studentJoinCode || projectDetails?.studentJoinCode,
        assignerJoinCode: task.assignerJoinCode || null,
        department: task.department || null,
        description: task.description || projectDetails?.description,
        startDate: projectDetails?.startDate,
        dueDate: projectDetails?.dueDate,
        priority: projectDetails?.priority,
      };
    });



    
    console.log("here is total assignment>>>>>>",updatedAssignments);

    res.status(200).json(updatedAssignments);
  } catch (error) {
    console.error("❌ Error fetching my assignments:", error);
    res.status(500).json({ message: "Error fetching my assignments", error });
  }
};

// ✅ Get all task assignments
exports.getAssignments = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // ✅ Fetch assigned tasks by user
    const assignments = await TaskAssignment.find({
      assignedBy: userId,
    }).populate("user assignedBy department");

    // ✅ Fetch all projects (since we need project details)
    const allProjects = await Task.find(); // Fetch all projects from Task table
    //  console.log("allProjects",allProjects);
    //  console.log("assignments",assignments);
    const updatedAssignments = assignments.map((task) => {
      const projectDetails = allProjects.find(
        (proj) => proj._id.toString() === task.project.toString()
      );

      return {
        ...task._doc, // Spread task details
        projectTitle: projectDetails ? projectDetails.title : "Unknown Project", // For display
        assignerJoinCode: task.assignerJoinCode || null,
        department: task.department || null,
      };
    });

    res.status(200).json(updatedAssignments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching assignments", error });
  }
};

// ✅ Get assignments by project
exports.getAssignmentsByProject = async (req, res) => {
  try {
    console.log("res>>>>>>", req.params);
    const { projectId } = req.params;
    const assignments = await TaskAssignment.find({
      project: projectId,
    }).populate("user assignedBy");
    res.status(200).json(assignments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching project assignments", error });
  }
};

// ✅ Delete an assignment
exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAssignment = await TaskAssignment.findByIdAndDelete(id);

    if (deletedAssignment?.project) {
      await Task.findByIdAndUpdate(deletedAssignment.project, { isAssigned: false });
    }

    res.status(200).json({ message: "Task assignment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting assignment", error });
  }
};
