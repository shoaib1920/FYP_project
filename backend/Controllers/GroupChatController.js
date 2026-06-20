const mongoose = require("mongoose");
const GroupMessage = require("../Models/GroupMessage");
const Project = require("../Models/Project");
const { getTeamsForUser, isMemberOfTeamChat } = require("../utils/teamChatMembership");

// GET /auth/group-chats — every team-group conversation the logged-in user belongs to
exports.getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const teams = await getTeamsForUser(userId);

    const groups = await Promise.all(
      teams.map(async (team) => {
        const [lastMessage, unreadCount, project] = await Promise.all([
          GroupMessage.findOne({ teamId: team._id }).sort({ timestamp: -1 }).lean(),
          GroupMessage.countDocuments({ teamId: team._id, readBy: { $ne: userId }, senderId: { $ne: userId } }),
          Project.findOne({ teamId: team._id }).select("title supervisorId").populate("supervisorId", "name").lean(),
        ]);

        return {
          teamId: team._id,
          subject: team.subject,
          department: team.department,
          memberNames: team.memberNames || [],
          memberCount: (team.members || []).length,
          projectTitle: project?.title || null,
          supervisorName: project?.supervisorId?.name || null,
          lastMessage: lastMessage
            ? { message: lastMessage.message, senderName: lastMessage.senderName, timestamp: lastMessage.timestamp, fileType: lastMessage.fileType }
            : null,
          unreadCount,
        };
      })
    );

    res.status(200).json({ success: true, groups });
  } catch (error) {
    console.error("Error fetching group chats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch group chats" });
  }
};

// GET /auth/group-chats/:teamId/messages
exports.getGroupMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ success: false, message: "Invalid team ID" });
    }

    const allowed = await isMemberOfTeamChat(userId, teamId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: "You are not a member of this team's chat" });
    }

    const messages = await GroupMessage.find({ teamId }).sort({ timestamp: 1 });

    // Mark everything as read by this user
    await GroupMessage.updateMany(
      { teamId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching group messages:", error);
    res.status(500).json({ success: false, message: "Failed to fetch group messages" });
  }
};
