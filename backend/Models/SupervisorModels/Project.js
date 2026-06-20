const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Project title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Project description is required"],
    },
    deadline: {
      type: Date,
      required: [true, "Deadline is required"],
    },
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Assuming 'User' is your collection for supervisors
      required: [true, "Supervisor ID is required"],
    },
    supervisorName: {
      type: String,
      required: [true, "Supervisor Name is required"],
    },
  },
  {
    timestamps: true, // createdAt and updatedAt fields
  }
);

module.exports = mongoose.model('SupervisorProject', projectSchema);
