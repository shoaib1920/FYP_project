const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: {
        type: String,
        required: true
    }, 
    email: {
        type: String,
        required: true,
        unique: true // optional but helpful
    },
    password: {
        type: String,
        required: true
    },
    designation: {
        type: String,
        default: "Student"
  },
  studentId: {
    type: String,
    required: true,
    unique: true
  },

  studentJoinCode: {
    type: String
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    default: null,
  },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: null },
  emailVerificationExpires: { type: Date, default: null },
});

const UserModel = mongoose.model("users", UserSchema);

module.exports = UserModel;
