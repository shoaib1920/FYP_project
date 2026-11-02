const userModel = require("../Models/Users");


const UserList = async (req, res) => {
    try {
        // This route is public, so never return credentials or one-time tokens.
        const users = await userModel
            .find()
            .select("-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires");
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({
            message: "Internal server error!",
            success: false
        });
    }
};


module.exports = { UserList };
