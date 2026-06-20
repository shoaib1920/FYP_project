require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const AuthRouter = require("./Routes/AuthRouter");
const path = require('path');
const jwt = require("jsonwebtoken");
const Message = require("./Models/Message");
const GroupMessage = require("./Models/GroupMessage");
const { getTeamsForUser, isMemberOfTeamChat } = require("./utils/teamChatMembership");
require("./Models/db");
require("./Models/Task");
require("./Models/TaskAssignment");
require("./Models/Department");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// In-memory maps: userId -> socketId, userId -> lastSeen Date
const onlineUsers = new Map();
const lastSeenMap = new Map();

// Socket.io JWT auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = String(decoded._id || decoded.id);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  onlineUsers.set(userId, socket.id);

  // Broadcast online status to all connected users
  io.emit("user_status", { userId, status: "online" });

  // Send current online users list to the newly connected user
  const onlineList = Array.from(onlineUsers.keys());
  socket.emit("online_users", onlineList);

  // Join a room per team-group chat this user belongs to, so group messages
  // can be broadcast without looking up members on every send.
  (async () => {
    try {
      const teams = await getTeamsForUser(userId);
      teams.forEach((team) => socket.join(`team_${team._id}`));
    } catch (err) {
      console.error("Error joining team chat rooms:", err);
    }
  })();

  // Deliver any undelivered messages
  (async () => {
    const undelivered = await Message.find({ receiverId: userId, status: "sent" });
    if (undelivered.length > 0) {
      await Message.updateMany({ receiverId: userId, status: "sent" }, { status: "delivered" });
      undelivered.forEach((msg) => {
        const senderSocket = onlineUsers.get(String(msg.senderId));
        if (senderSocket) {
          io.to(senderSocket).emit("message_status_update", {
            messageId: msg._id,
            status: "delivered",
          });
        }
      });
    }
  })();

  // Real-time message send
  socket.on("send_message", async (data) => {
    const { receiverId, message, fileUrl, fileName, fileSize, fileType, tempId } = data;

    const newMsg = await Message.create({
      senderId: userId,
      receiverId,
      message: message || "",
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      fileType: fileType || null,
      status: "sent",
    });

    const payload = {
      _id: newMsg._id,
      tempId,
      senderId: userId,
      receiverId,
      message: newMsg.message,
      fileUrl: newMsg.fileUrl,
      fileName: newMsg.fileName,
      fileSize: newMsg.fileSize,
      fileType: newMsg.fileType,
      timestamp: newMsg.timestamp,
      status: "sent",
    };

    // Confirm to sender
    socket.emit("message_sent", payload);

    // Deliver to receiver if online
    const receiverSocket = onlineUsers.get(String(receiverId));
    if (receiverSocket) {
      io.to(receiverSocket).emit("receive_message", payload);
      // Mark as delivered immediately
      await Message.findByIdAndUpdate(newMsg._id, { status: "delivered" });
      socket.emit("message_status_update", { messageId: newMsg._id, tempId, status: "delivered" });
    }
  });

  // Mark messages as read
  socket.on("mark_read", async ({ senderId }) => {
    await Message.updateMany(
      { senderId, receiverId: userId, status: { $in: ["sent", "delivered"] } },
      { status: "read" }
    );
    const senderSocket = onlineUsers.get(String(senderId));
    if (senderSocket) {
      io.to(senderSocket).emit("messages_read", { by: userId });
    }
  });

  // Typing indicators
  socket.on("typing", ({ receiverId }) => {
    const receiverSocket = onlineUsers.get(String(receiverId));
    if (receiverSocket) io.to(receiverSocket).emit("user_typing", { senderId: userId });
  });

  socket.on("stop_typing", ({ receiverId }) => {
    const receiverSocket = onlineUsers.get(String(receiverId));
    if (receiverSocket) io.to(receiverSocket).emit("user_stop_typing", { senderId: userId });
  });

  // ── Group (team) chat ──
  socket.on("send_group_message", async (data) => {
    const { teamId, senderName, senderRole, message, fileUrl, fileName, fileSize, fileType, tempId } = data;

    const allowed = await isMemberOfTeamChat(userId, teamId);
    if (!allowed) return;

    const newMsg = await GroupMessage.create({
      teamId,
      senderId: userId,
      senderName,
      senderRole: senderRole || "Student",
      message: message || "",
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      fileType: fileType || null,
      readBy: [userId],
    });

    const payload = {
      _id: newMsg._id,
      tempId,
      teamId,
      senderId: userId,
      senderName,
      senderRole: newMsg.senderRole,
      message: newMsg.message,
      fileUrl: newMsg.fileUrl,
      fileName: newMsg.fileName,
      fileSize: newMsg.fileSize,
      fileType: newMsg.fileType,
      timestamp: newMsg.timestamp,
    };

    io.to(`team_${teamId}`).emit("receive_group_message", payload);
  });

  socket.on("mark_group_read", async ({ teamId }) => {
    const allowed = await isMemberOfTeamChat(userId, teamId);
    if (!allowed) return;
    await GroupMessage.updateMany(
      { teamId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );
    io.to(`team_${teamId}`).emit("group_messages_read", { teamId, by: userId });
  });

  socket.on("group_typing", ({ teamId, senderName }) => {
    socket.to(`team_${teamId}`).emit("group_user_typing", { teamId, senderId: userId, senderName });
  });

  socket.on("group_stop_typing", ({ teamId }) => {
    socket.to(`team_${teamId}`).emit("group_user_stop_typing", { teamId, senderId: userId });
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(userId);
    lastSeenMap.set(userId, new Date());
    io.emit("user_status", { userId, status: "offline", lastSeen: lastSeenMap.get(userId) });
  });
});

// Expose io and onlineUsers for controllers
app.set("io", io);
app.set("onlineUsers", onlineUsers);
app.set("lastSeenMap", lastSeenMap);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(bodyParser.json());

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
}));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 },
  })
);

app.use('/auth', AuthRouter);

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
