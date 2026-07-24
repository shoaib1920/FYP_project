const Notification = require("../Models/Notification");
const { getIo, getOnlineUsers } = require("./socketRegistry");

// Creates a Notification document and, if the recipient is currently online,
// pushes it to them immediately over their existing chat socket connection —
// previously notifications were pure poll/REST, so a user only ever saw a new
// one after manually reloading the page despite the socket infra already
// existing for chat. Replaces the near-identical copy that used to live in
// each of ProjectController/ProposalController/ProgressLogController/
// MeetingLogController/ProjectReviewNoteController/TeamController.
const createNotification = async ({ userId, title, message, relatedType, relatedId }) => {
  try {
    const notification = await Notification.create({ userId, title, message, relatedType, relatedId });

    const io = getIo();
    const onlineUsers = getOnlineUsers();
    if (io && onlineUsers) {
      const socketId = onlineUsers.get(String(userId));
      if (socketId) io.to(socketId).emit("new_notification", notification);
    }

    return notification;
  } catch (err) {
    console.error("Notification creation failed:", err);
    return null;
  }
};

module.exports = { createNotification };
