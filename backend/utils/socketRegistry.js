// A tiny mutable registry so controllers (which can't require index.js without
// a circular dependency) can reach the live Socket.IO server + onlineUsers map
// that index.js creates. index.js calls register() once at startup.
let io = null;
let onlineUsers = null;

const register = (ioInstance, onlineUsersMap) => {
  io = ioInstance;
  onlineUsers = onlineUsersMap;
};

const getIo = () => io;
const getOnlineUsers = () => onlineUsers;

module.exports = { register, getIo, getOnlineUsers };
