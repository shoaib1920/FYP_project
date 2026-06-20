const userModel = require("../Models/Users");
const Department = require("../Models/Department");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendVerificationEmail } = require("./EmailVerificationController");

// ✅ Student Signup with Department Join Code
const studentSignup = async(req, res) => {
  try{
    const { name, email, password, studentJoinCode ,
  studentId } = req.body;

    // Validate required fields
    if (!name || !email || !password || !studentJoinCode || !studentId) {
      return res.status(400).json({
        message: "All fields (name, email, password, studentJoinCode ,studentId) are required.",
        success: false,
      });
    }

    // Check if user already exists
    const user = await userModel.findOne({ email });
    if(user){
      return res.status(400).json({
        message: "User already exists",
        success: false,
      });
    }

    // Verify student join code
    const department = await Department.findOne({
      studentJoinCode: studentJoinCode.toUpperCase(),
      isActive: true,
    });

    if (!department) {
      return res.status(400).json({
        message: "Invalid or expired student join code.",
        success: false,
      });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
      designation: "Student",
      studentId,
      studentJoinCode: studentJoinCode.toUpperCase(),
      department: department._id,
    });

    await newUser.save();

    // Update department student count
    await Department.findByIdAndUpdate(department._id, {
      $inc: { totalStudents: 1 },
    });

    await sendVerificationEmail(newUser, "student");

    res.status(201).json({
      message: "Student registered successfully. Please check your email to verify your account before logging in.",
      success: true,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        student_id:  newUser.studentId,
    student_JoinCode: newUser.studentJoinCode,
        department: department.name,
      },
    });
  } catch(error){
    console.error("Student signup error:", error);
    res.status(500).json({
      message: "Internal server error!",
      success: false,
      error: error.message,
    });
  }
};

// // ✅ Old signup (keep for backward compatibility if needed)
const signup = async(req, res) => {
  try{
    const { name, email, password } = req.body;
    const user = await userModel.findOne({email});
    if(user){
      return res.status(400).json({message:"user already exists",success:false});
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new userModel({ name, email, password: hashedPassword }); 
    await newUser.save();
    res.status(201).json({message:"user created successfully",success:true, user: {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email
    }});
  }catch(error){
    res.status(500).json({
      message:"Internal server error!",
      success:false
    });
  }
};
     
const login = async(req, res) => {
  try{
    const {  email, password } = req.body;
    const user = await userModel.findOne({email}).populate("department");
    const errorMsg="Authentication failed! email or password is wrong.";
    if(!user){
      return res.status(403).json({message:errorMsg,success:false});
    }
    const isEqualPassword = await bcrypt.compare(password,user.password);
    if(!isEqualPassword){
      return res.status(403).json({message:errorMsg,success:false});
    }
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in. Check your inbox for the verification link.",
        success: false,
        unverified: true,
      });
    }
    const jwtToken = jwt.sign(
      {email: user.email,_id: user._id ,studentJoinCode: user.studentJoinCode , studentId: user.studentId, role: "student"},
      process.env.JWT_SECRET,
      {expiresIn: "24h"}
    )
    res.status(201).json({message:"Login successfully ;)",success:true,
      token:jwtToken,
      user:{
        id:user._id,
        name:user.name,
        email:user.email,
        department: user.department ? user.department.name : null,
        studentId: user.studentId,
        designation: user.designation,
        studentJoinCode: user.studentJoinCode,
      }
    });
  }catch(error){
    res.status(500).json({
      message:"Internal server error!",
      success:false
    });
  }
};

module.exports = {
  signup,
  studentSignup,
  login,
};