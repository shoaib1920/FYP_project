const userModel = require("../Models/Users");
const jwt = require("jsonwebtoken");

const verifyOTP = async (req, res) => {
    try {
        const { userId, otp } = req.body;

        const user = await userModel.findById(userId);
        if (!user || user.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP", success: false });
        }

        if (user.otpExpiry < Date.now()) {
            return res.status(400).json({ message: "OTP expired", success: false });
        }

        user.otp = null;
        user.otpExpiry = null;
        user.isVerified = true;
        await user.save();

        // ✅ Now generate final JWT token
        const token = jwt.sign(
            { email: user.email, _id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.status(200).json({
            message: "OTP verified. Login successful.",
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.log("Verify OTP error >>", error.message);
        res.status(500).json({
            message: "Internal server error!",
            success: false
        });
    }
};

module.exports = verifyOTP;