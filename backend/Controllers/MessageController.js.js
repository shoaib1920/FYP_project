const mongoose = require('mongoose');
const Message = require('../Models/Message');
const Users = require("../Models/Users");
const Supervisors = require('../Models/supervisorModel');
const path = require('path');

// Upload chat media file (image/video/document)
exports.uploadChatFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const mime = req.file.mimetype;
    let fileType = 'document';
    if (mime.startsWith('image/')) fileType = 'image';
    else if (mime.startsWith('video/')) fileType = 'video';

    const fileUrl = req.file.path;

    res.status(200).json({
      success: true,
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType,
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, message: 'File upload failed' });
  }
};

// Send a text message via HTTP (fallback — socket is preferred)
exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { receiverId, message, fileUrl, fileName, fileSize, fileType } = req.body;

    if (!message && !fileUrl) {
      return res.status(400).json({ success: false, message: 'Message or file is required' });
    }
    if (!receiverId) {
      return res.status(400).json({ success: false, message: 'receiverId is required' });
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      message: message || '',
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      fileType: fileType || null,
    });

    // Notify receiver via socket if online
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    const receiverSocket = onlineUsers?.get(String(receiverId));
    if (receiverSocket) {
      await Message.findByIdAndUpdate(newMessage._id, { status: 'delivered' });
      newMessage.status = 'delivered';
      io.to(receiverSocket).emit('receive_message', newMessage);
    }

    res.status(201).json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

// Get conversation between current user and receiverId
exports.getMessages = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { receiverId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    }).sort({ timestamp: 1 });

    // Auto mark received messages as read
    await Message.updateMany(
      { senderId: receiverId, receiverId: senderId, status: { $in: ['sent', 'delivered'] } },
      { status: 'read' }
    );

    // Notify sender that their messages have been read
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    const senderSocket = onlineUsers?.get(String(receiverId));
    if (senderSocket) {
      io.to(senderSocket).emit('messages_read', { by: String(senderId) });
    }

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
};

// Mark messages from a sender as read
exports.markAsRead = async (req, res) => {
  try {
    const receiverId = req.user._id;
    const { senderId } = req.params;

    await Message.updateMany(
      { senderId, receiverId, status: { $in: ['sent', 'delivered'] } },
      { status: 'read' }
    );

    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    const senderSocket = onlineUsers?.get(String(senderId));
    if (senderSocket) {
      io.to(senderSocket).emit('messages_read', { by: String(receiverId) });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};

// Get online status and last seen for a list of userIds
exports.getUsersStatus = async (req, res) => {
  try {
    const onlineUsers = req.app.get('onlineUsers');
    const lastSeenMap = req.app.get('lastSeenMap');
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ success: false, message: 'userIds must be an array' });
    }

    const result = userIds.map((id) => ({
      userId: id,
      online: onlineUsers?.has(String(id)) || false,
      lastSeen: lastSeenMap?.get(String(id)) || null,
    }));

    res.status(200).json({ success: true, statuses: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get statuses' });
  }
};

// Get list of users who have chatted with the current user
exports.getAllMessages = async (req, res) => {
  const { userId } = req.params;
  try {
    const senders = await Message.distinct('senderId', { receiverId: userId });
    res.status(200).json({ senders });
  } catch (error) {
    console.error('Get chat senders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
