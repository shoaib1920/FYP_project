import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { FaComments } from "react-icons/fa";
import { resolveFileUrl } from "../../../utils/resolveFileUrl";
import "./Message.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

let supervisorSocketInstance = null;

function getSocket(token) {
  if (!supervisorSocketInstance || !supervisorSocketInstance.connected) {
    supervisorSocketInstance = io(API, {
      auth: { token },
      transports: ["polling"],
      reconnectionAttempts: 5,
    });
  }
  return supervisorSocketInstance;
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatLastSeen(date) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMins = Math.floor((now - d) / 60000);
  if (diffMins < 1) return "last seen just now";
  if (diffMins < 60) return `last seen ${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `last seen ${diffHrs}h ago`;
  return `last seen ${d.toLocaleDateString()}`;
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageTicks({ status }) {
  if (status === "read") return <span className="ticks ticks-read">✓✓</span>;
  if (status === "delivered") return <span className="ticks ticks-delivered">✓✓</span>;
  return <span className="ticks">✓</span>;
}

const SupervisorChatBox = () => {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [token, setToken] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastSeen, setLastSeen] = useState({});
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarTab, setSidebarTab] = useState("chats"); // "chats" | "groups"
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [socket, setSocket] = useState(null);

  // Group (team) chat
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupTypingUsers, setGroupTypingUsers] = useState(new Map());

  // Department-wide chat (all students/supervisors/admin of the department)
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [deptMessages, setDeptMessages] = useState([]);
  const [deptTypingUsers, setDeptTypingUsers] = useState(new Map());
  const [deptNotice, setDeptNotice] = useState("");

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const selectedGroupRef = useRef(null);
  const selectedDepartmentRef = useRef(null);

  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);
  useEffect(() => { selectedDepartmentRef.current = selectedDepartment; }, [selectedDepartment]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, groupMessages, scrollToBottom]);

  // Load supervisor identity (uses same `token` key, identity from supervisorData)
  useEffect(() => {
    const supData = localStorage.getItem("supervisorData");
    const tok = localStorage.getItem("token");
    if (supData && tok) {
      try {
        const parsed = JSON.parse(supData);
        setCurrentUserId(parsed._id || parsed.id);
        setCurrentUserName(parsed.name || "Me");
        setToken(tok);
      } catch {}
    }
  }, []);

  // Init socket
  useEffect(() => {
    if (!token || !currentUserId) return;
    const sock = getSocket(token);
    setSocket(sock);

    sock.on("online_users", (ids) => {
      setOnlineUsers(new Set(ids.map(String)));
    });

    sock.on("user_status", ({ userId, status, lastSeen: ls }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === "online") next.add(String(userId));
        else next.delete(String(userId));
        return next;
      });
      if (status === "offline" && ls) {
        setLastSeen((prev) => ({ ...prev, [String(userId)]: ls }));
      }
    });

    sock.on("receive_message", (msg) => {
      setMessages((prev) => {
        if (prev.some(
          (m) =>
            String(m._id) === String(msg._id) ||
            (msg.tempId && m.tempId && String(m.tempId) === String(msg.tempId))
        )) return prev;
        return [...prev, msg];
      });
    });

    sock.on("message_sent", (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => !m.tempId && String(m._id) === String(msg._id))) return prev;
        return prev.map((m) => (m.tempId && m.tempId === msg.tempId ? { ...msg } : m));
      });
    });

    sock.on("message_status_update", ({ messageId, tempId, status }) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId) || (tempId && m.tempId === tempId)
            ? { ...m, status }
            : m
        )
      );
    });

    sock.on("messages_read", ({ by }) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m.receiverId) === String(by) ? { ...m, status: "read" } : m
        )
      );
    });

    sock.on("user_typing", ({ senderId }) => {
      setTypingUsers((prev) => new Set([...prev, String(senderId)]));
    });

    sock.on("user_stop_typing", ({ senderId }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(String(senderId));
        return next;
      });
    });

    sock.on("receive_group_message", (msg) => {
      const isOpen = String(selectedGroupRef.current?.teamId) === String(msg.teamId);
      if (isOpen) {
        setGroupMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
          if (msg.tempId && prev.some((m) => m.tempId && String(m.tempId) === String(msg.tempId))) {
            return prev.map((m) => (m.tempId && String(m.tempId) === String(msg.tempId) ? { ...msg } : m));
          }
          return [...prev, msg];
        });
      }
      setGroups((prev) =>
        prev.map((g) =>
          String(g.teamId) === String(msg.teamId)
            ? {
                ...g,
                lastMessage: { message: msg.message, senderName: msg.senderName, timestamp: msg.timestamp, fileType: msg.fileType },
                unreadCount: isOpen || String(msg.senderId) === String(currentUserId) ? 0 : (g.unreadCount || 0) + 1,
              }
            : g
        )
      );
    });

    sock.on("group_user_typing", ({ teamId, senderId, senderName }) => {
      if (String(selectedGroupRef.current?.teamId) !== String(teamId)) return;
      setGroupTypingUsers((prev) => new Map(prev).set(String(senderId), senderName));
    });

    sock.on("group_user_stop_typing", ({ teamId, senderId }) => {
      if (String(selectedGroupRef.current?.teamId) !== String(teamId)) return;
      setGroupTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(String(senderId));
        return next;
      });
    });

    sock.on("receive_dept_message", (msg) => {
      const isOpen = String(selectedDepartmentRef.current?._id) === String(msg.departmentId);
      if (isOpen) {
        setDeptMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
          if (msg.tempId && prev.some((m) => m.tempId && String(m.tempId) === String(msg.tempId))) {
            return prev.map((m) => (m.tempId && String(m.tempId) === String(msg.tempId) ? { ...msg } : m));
          }
          return [...prev, msg];
        });
      }
    });

    sock.on("dept_message_rejected", ({ reason }) => {
      setDeptNotice(reason || "Your message couldn't be sent.");
      setTimeout(() => setDeptNotice(""), 5000);
    });

    sock.on("dept_user_typing", ({ departmentId, senderId, senderName }) => {
      if (String(selectedDepartmentRef.current?._id) !== String(departmentId)) return;
      setDeptTypingUsers((prev) => new Map(prev).set(String(senderId), senderName));
    });

    sock.on("dept_user_stop_typing", ({ departmentId, senderId }) => {
      if (String(selectedDepartmentRef.current?._id) !== String(departmentId)) return;
      setDeptTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(String(senderId));
        return next;
      });
    });

    return () => {
      sock.off("online_users");
      sock.off("user_status");
      sock.off("receive_message");
      sock.off("message_sent");
      sock.off("message_status_update");
      sock.off("messages_read");
      sock.off("user_typing");
      sock.off("user_stop_typing");
      sock.off("receive_group_message");
      sock.off("group_user_typing");
      sock.off("group_user_stop_typing");
      sock.off("receive_dept_message");
      sock.off("dept_message_rejected");
      sock.off("dept_user_typing");
      sock.off("dept_user_stop_typing");
    };
  }, [token, currentUserId]);

  // Load my team groups
  useEffect(() => {
    if (!currentUserId || !token) return;
    const fetchGroups = async () => {
      try {
        const res = await axios.get(`${API}/auth/group-chats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGroups(res.data.groups || []);
      } catch (err) {
        console.error("Failed to load team groups:", err);
      }
    };
    fetchGroups();
  }, [currentUserId, token]);

  // Load my department chat(s)
  useEffect(() => {
    if (!currentUserId || !token) return;
    const fetchDepartments = async () => {
      try {
        const res = await axios.get(`${API}/auth/department-chat/my-departments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const depts = res.data.departments || [];
        setDepartments(depts);
        if (depts.length === 1) setSelectedDepartment(depts[0]);
      } catch (err) {
        console.error("Failed to load department chat:", err);
      }
    };
    fetchDepartments();
  }, [currentUserId, token]);

  // Load contacts: students from assigned project teams + all admins
  useEffect(() => {
    if (!currentUserId || !token) return;

    const fetchContacts = async () => {
      try {
        const [adminsRes, projectsRes] = await Promise.all([
          axios.get(`${API}/auth/admins`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/auth/projects/supervisor`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const admins = (adminsRes.data.admins || adminsRes.data || []).map((a) => ({
          ...a,
          role: "Admin",
        }));

        const projects = projectsRes.data.projects || [];
        const studentsMap = new Map();
        projects.forEach((p) => {
          if (p.teamLeaderId?._id) {
            studentsMap.set(String(p.teamLeaderId._id), { ...p.teamLeaderId, role: "Student" });
          }
          (p.teamId?.members || []).forEach((m) => {
            if (m?._id) studentsMap.set(String(m._id), { ...m, role: "Student" });
          });
        });
        const relatedStudents = Array.from(studentsMap.values());

        const combined = [...relatedStudents, ...admins].filter(
          (u) => String(u._id) !== String(currentUserId)
        );

        setContacts(combined);
        setFilteredContacts(combined);
      } catch (err) {
        console.error("Failed to load supervisor contacts:", err);
      }
    };

    fetchContacts();
  }, [currentUserId, token]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
    } else {
      setFilteredContacts(
        contacts.filter((c) => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
  }, [searchQuery, contacts]);

  // Load messages for selected user
  useEffect(() => {
    if (!selectedUser || !token) return;
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API}/auth/messages/${selectedUser._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(res.data.messages || []);
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    };
    fetchMessages();
    if (socket) socket.emit("mark_read", { senderId: selectedUser._id });
  }, [selectedUser, token, socket]);

  // Load messages when selecting a team group
  useEffect(() => {
    if (!selectedGroup || !token) return;
    const fetchGroupMessages = async () => {
      try {
        const res = await axios.get(`${API}/auth/group-chats/${selectedGroup.teamId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGroupMessages(res.data.messages || []);
      } catch (err) {
        console.error("Failed to load group messages:", err);
      }
    };
    fetchGroupMessages();

    if (socket) socket.emit("mark_group_read", { teamId: selectedGroup.teamId });
    setGroups((prev) =>
      prev.map((g) => (String(g.teamId) === String(selectedGroup.teamId) ? { ...g, unreadCount: 0 } : g))
    );
  }, [selectedGroup, token, socket]);

  // Load messages when selecting the department chat
  useEffect(() => {
    if (!selectedDepartment || !token) return;
    const fetchDeptMessages = async () => {
      try {
        const res = await axios.get(`${API}/auth/department-chat/${selectedDepartment._id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDeptMessages(res.data.messages || []);
      } catch (err) {
        console.error("Failed to load department messages:", err);
      }
    };
    fetchDeptMessages();

    if (socket) socket.emit("mark_dept_read", { departmentId: selectedDepartment._id });
  }, [selectedDepartment, token, socket]);

  const openUser = (user) => {
    setSelectedGroup(null);
    setSelectedDepartment(null);
    setSelectedUser(user);
  };

  const openGroup = (group) => {
    setSelectedUser(null);
    setSelectedDepartment(null);
    setSelectedGroup(group);
  };

  const openDepartment = (dept) => {
    setSelectedUser(null);
    setSelectedGroup(null);
    setSelectedDepartment(dept);
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!socket) return;
    if (selectedGroup) {
      socket.emit("group_typing", { teamId: selectedGroup.teamId, senderName: currentUserName });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("group_stop_typing", { teamId: selectedGroup.teamId });
      }, 1500);
    } else if (selectedDepartment) {
      socket.emit("dept_typing", { departmentId: selectedDepartment._id, senderName: currentUserName });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("dept_stop_typing", { departmentId: selectedDepartment._id });
      }, 1500);
    } else if (selectedUser) {
      socket.emit("typing", { receiverId: selectedUser._id });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("stop_typing", { receiverId: selectedUser._id });
      }, 1500);
    }
  };

  const handleSendMessage = () => {
    if ((!newMessage.trim() && !filePreview) || !selectedUser || !socket) return;

    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      _id: tempId,
      tempId,
      senderId: currentUserId,
      receiverId: selectedUser._id,
      message: newMessage.trim(),
      fileUrl: filePreview?.url || null,
      fileName: filePreview?.name || null,
      fileSize: filePreview?.size || null,
      fileType: filePreview?.type || null,
      timestamp: new Date(),
      status: "sent",
    };

    setMessages((prev) => [...prev, optimistic]);
    socket.emit("send_message", {
      receiverId: selectedUser._id,
      message: newMessage.trim(),
      fileUrl: filePreview?.url || null,
      fileName: filePreview?.name || null,
      fileSize: filePreview?.size || null,
      fileType: filePreview?.type || null,
      tempId,
    });
    socket.emit("stop_typing", { receiverId: selectedUser._id });
    setNewMessage("");
    setFilePreview(null);
  };

  const handleSendGroupMessage = () => {
    if ((!newMessage.trim() && !filePreview) || !selectedGroup || !socket) return;

    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      _id: tempId,
      tempId,
      teamId: selectedGroup.teamId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: "Supervisor",
      message: newMessage.trim(),
      fileUrl: filePreview?.url || null,
      fileName: filePreview?.name || null,
      fileSize: filePreview?.size || null,
      fileType: filePreview?.type || null,
      timestamp: new Date(),
    };

    setGroupMessages((prev) => [...prev, optimistic]);
    socket.emit("send_group_message", {
      teamId: selectedGroup.teamId,
      senderName: currentUserName,
      senderRole: "Supervisor",
      message: newMessage.trim(),
      fileUrl: filePreview?.url || null,
      fileName: filePreview?.name || null,
      fileSize: filePreview?.size || null,
      fileType: filePreview?.type || null,
      tempId,
    });
    socket.emit("group_stop_typing", { teamId: selectedGroup.teamId });
    setNewMessage("");
    setFilePreview(null);
  };

  const handleSendDeptMessage = () => {
    if ((!newMessage.trim() && !filePreview) || !selectedDepartment || !socket) return;

    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      _id: tempId,
      tempId,
      departmentId: selectedDepartment._id,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: "Supervisor",
      message: newMessage.trim(),
      fileUrl: filePreview?.url || null,
      fileName: filePreview?.name || null,
      fileSize: filePreview?.size || null,
      fileType: filePreview?.type || null,
      timestamp: new Date(),
    };

    setDeptMessages((prev) => [...prev, optimistic]);

    socket.emit("send_dept_message", {
      departmentId: selectedDepartment._id,
      senderName: currentUserName,
      senderRole: "Supervisor",
      message: newMessage.trim(),
      fileUrl: filePreview?.url || null,
      fileName: filePreview?.name || null,
      fileSize: filePreview?.size || null,
      fileType: filePreview?.type || null,
      tempId,
    });

    socket.emit("dept_stop_typing", { departmentId: selectedDepartment._id });
    setNewMessage("");
    setFilePreview(null);
  };

  const handleSend = () => {
    if (selectedGroup) handleSendGroupMessage();
    else if (selectedDepartment) handleSendDeptMessage();
    else handleSendMessage();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/auth/messages/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      const { fileUrl, fileName, fileSize, fileType } = res.data;
      setFilePreview({
        url: fileUrl,
        name: fileName,
        size: fileSize,
        type: fileType,
        localUrl: URL.createObjectURL(file),
      });
    } catch (err) {
      console.error("File upload failed:", err);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDownload = async (fileUrl, fileName) => {
    try {
      const res = await axios.get(resolveFileUrl(fileUrl), { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || "download";
      a.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(resolveFileUrl(fileUrl), "_blank");
    }
  };

  const isOnline = selectedUser && onlineUsers.has(String(selectedUser._id));
  const isTyping = selectedUser && typingUsers.has(String(selectedUser._id));

  const renderMediaInMessage = (msg) => {
    const url = resolveFileUrl(msg.fileUrl);
    if (msg.fileType === "image") {
      return (
        <div className="msg-media">
          <img src={url} alt={msg.fileName} onClick={() => window.open(url, "_blank")} />
          <button className="dl-btn" onClick={() => handleDownload(msg.fileUrl, msg.fileName)}>⬇ Download</button>
        </div>
      );
    }
    if (msg.fileType === "video") {
      return (
        <div className="msg-media">
          <video controls src={url} />
          <button className="dl-btn" onClick={() => handleDownload(msg.fileUrl, msg.fileName)}>⬇ Download</button>
        </div>
      );
    }
    return (
      <div className="msg-doc">
        <span className="doc-icon">📄</span>
        <div className="doc-info">
          <span className="doc-name">{msg.fileName}</span>
          <span className="doc-size">{formatFileSize(msg.fileSize)}</span>
        </div>
        <button className="dl-btn" onClick={() => handleDownload(msg.fileUrl, msg.fileName)}>⬇</button>
      </div>
    );
  };

  const onlineCount = contacts.filter((c) => onlineUsers.has(String(c._id))).length;

  return (
    <div className="wa-page">
      <div className="wa-page-hero">
        <div className="wa-page-hero-icon"><FaComments /></div>
        <div className="wa-page-hero-text">
          <h2 className="wa-page-heading">Messages</h2>
          <p className="wa-page-subheading">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} · {onlineCount} online
          </p>
        </div>
      </div>

    <div className="wa-wrapper">
      {/* Sidebar */}
      <div className="wa-sidebar">
        <div className="wa-sidebar-tabs">
          <button
            className={`wa-tab-btn ${sidebarTab === "chats" ? "active" : ""}`}
            onClick={() => setSidebarTab("chats")}
          >
            Chats
          </button>
          <button
            className={`wa-tab-btn ${sidebarTab === "groups" ? "active" : ""}`}
            onClick={() => setSidebarTab("groups")}
          >
            Groups{groups.length > 0 ? ` (${groups.length})` : ""}
          </button>
          <button
            className={`wa-tab-btn ${sidebarTab === "department" ? "active" : ""}`}
            onClick={() => setSidebarTab("department")}
          >
            Department
          </button>
        </div>

        {sidebarTab === "department" ? (
          <div className="wa-contact-list wa-group-list">
            {departments.length === 0 ? (
              <div className="wa-empty-tab">No department chat available.</div>
            ) : (
              departments.map((dept) => (
                <div
                  key={dept._id}
                  className={`wa-contact ${selectedDepartment?._id === dept._id ? "active" : ""}`}
                  onClick={() => openDepartment(dept)}
                >
                  <div className="wa-avatar group-avatar">🏛️</div>
                  <div className="wa-contact-info">
                    <span className="wa-contact-name">{dept.name}</span>
                    <span className="wa-contact-sub">All students, supervisors &amp; admin — {dept.code}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : sidebarTab === "groups" ? (
          <div className="wa-contact-list wa-group-list">
            {groups.length === 0 ? (
              <div className="wa-empty-tab">No groups yet.</div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.teamId}
                  className={`wa-contact ${selectedGroup?.teamId === group.teamId ? "active" : ""}`}
                  onClick={() => openGroup(group)}
                >
                  <div className="wa-avatar group-avatar">👥</div>
                  <div className="wa-contact-info">
                    <span className="wa-contact-name">{group.subject || "Team Chat"}</span>
                    <span className="wa-contact-sub">
                      {group.lastMessage
                        ? `${group.lastMessage.senderName}: ${group.lastMessage.message || "📎 Attachment"}`
                        : `${group.memberCount} members${group.projectTitle ? ` · ${group.projectTitle}` : ""}`}
                    </span>
                  </div>
                  {group.unreadCount > 0 && <span className="unread-badge">{group.unreadCount}</span>}
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="wa-search">
              <input
                type="text"
                placeholder="🔍 Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="wa-contact-list">
              {filteredContacts.map((user) => {
                const online = onlineUsers.has(String(user._id));
                const ls = lastSeen[String(user._id)];
                return (
                  <div
                    key={user._id}
                    className={`wa-contact ${selectedUser?._id === user._id ? "active" : ""}`}
                    onClick={() => openUser(user)}
                  >
                    <div className="wa-avatar">
                      {user.name?.[0]?.toUpperCase() || "?"}
                      <span className={`status-dot ${online ? "online" : "offline"}`} />
                    </div>
                    <div className="wa-contact-info">
                      <span className="wa-contact-name">{user.name}</span>
                      <span className="wa-contact-sub">
                        {online ? "online" : ls ? formatLastSeen(ls) : user.role}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredContacts.length === 0 && (
                <div style={{ padding: "20px 16px", color: "#8696a0", fontSize: "0.85rem" }}>
                  No contacts yet. Contacts appear once you are assigned to a project.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Chat Area */}
      <div className="wa-chat">
        {selectedDepartment ? (
          <>
            <div className="wa-chat-header">
              <div className="wa-avatar large group-avatar">🏛️</div>
              <div className="wa-header-info">
                <span className="wa-header-name">{selectedDepartment.name} — Department</span>
                <span className="wa-header-status">
                  {deptTypingUsers.size > 0
                    ? `${Array.from(deptTypingUsers.values()).join(", ")} typing...`
                    : "All students, supervisors & admin of this department"}
                </span>
              </div>
            </div>

            {deptNotice && <div className="file-preview-bar" style={{ color: "#b91c1c" }}>{deptNotice}</div>}

            <div className="wa-messages">
              {deptMessages.map((msg, i) => {
                const isMine = String(msg.senderId) === String(currentUserId);
                return (
                  <div key={msg._id || i} className={`wa-bubble-wrap ${isMine ? "mine" : "theirs"}`}>
                    <div className={`wa-bubble ${isMine ? "sent" : "received"}`}>
                      {!isMine && <p className="bubble-sender">{msg.senderName} ({msg.senderRole})</p>}
                      {msg.fileUrl && renderMediaInMessage(msg)}
                      {msg.message && <p className="bubble-text">{msg.message}</p>}
                      <div className="wa-bubble-meta">
                        <span className="wa-time">{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {filePreview && (
              <div className="file-preview-bar">
                {filePreview.type === "image" && <img src={filePreview.localUrl} alt="preview" className="fp-img" />}
                {filePreview.type === "video" && <video src={filePreview.localUrl} className="fp-video" muted />}
                {filePreview.type === "document" && <span className="fp-doc">📄 {filePreview.name}</span>}
                <button className="fp-remove" onClick={() => setFilePreview(null)}>✕</button>
              </div>
            )}

            <div className="wa-input-bar">
              <button
                className="attach-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file, image or video"
                disabled={uploadingFile}
              >
                {uploadingFile ? "⏳" : "📎"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.pptx,.xlsx,.zip"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <textarea
                className="wa-input"
                placeholder="Message the department..."
                value={newMessage}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button className="wa-send-btn" onClick={handleSend} disabled={!newMessage.trim() && !filePreview}>
                ➤
              </button>
            </div>
          </>
        ) : selectedGroup ? (
          <>
            <div className="wa-chat-header">
              <div className="wa-avatar large group-avatar">👥</div>
              <div className="wa-header-info">
                <span className="wa-header-name">{selectedGroup.subject || "Team Chat"}</span>
                <span className="wa-header-status">
                  {groupTypingUsers.size > 0
                    ? `${Array.from(groupTypingUsers.values()).join(", ")} typing...`
                    : `${selectedGroup.memberCount} members${selectedGroup.projectTitle ? ` · ${selectedGroup.projectTitle}` : ""}`}
                </span>
              </div>
            </div>

            <div className="wa-messages">
              {groupMessages.map((msg, i) => {
                const isMine = String(msg.senderId) === String(currentUserId);
                return (
                  <div key={msg._id || i} className={`wa-bubble-wrap ${isMine ? "mine" : "theirs"}`}>
                    <div className={`wa-bubble ${isMine ? "sent" : "received"}`}>
                      {!isMine && <p className="bubble-sender">{msg.senderName}</p>}
                      {msg.fileUrl && renderMediaInMessage(msg)}
                      {msg.message && <p className="bubble-text">{msg.message}</p>}
                      <div className="wa-bubble-meta">
                        <span className="wa-time">{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {filePreview && (
              <div className="file-preview-bar">
                {filePreview.type === "image" && <img src={filePreview.localUrl} alt="preview" className="fp-img" />}
                {filePreview.type === "video" && <video src={filePreview.localUrl} className="fp-video" muted />}
                {filePreview.type === "document" && <span className="fp-doc">📄 {filePreview.name}</span>}
                <button className="fp-remove" onClick={() => setFilePreview(null)}>✕</button>
              </div>
            )}

            <div className="wa-input-bar">
              <button
                className="attach-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file, image or video"
                disabled={uploadingFile}
              >
                {uploadingFile ? "⏳" : "📎"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.pptx,.xlsx,.zip"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <textarea
                className="wa-input"
                placeholder="Message the team..."
                value={newMessage}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="wa-send-btn"
                onClick={handleSend}
                disabled={!newMessage.trim() && !filePreview}
              >
                ➤
              </button>
            </div>
          </>
        ) : selectedUser ? (
          <>
            <div className="wa-chat-header">
              <div className="wa-avatar large">
                {selectedUser.name?.[0]?.toUpperCase() || "?"}
                <span className={`status-dot ${isOnline ? "online" : "offline"}`} />
              </div>
              <div className="wa-header-info">
                <span className="wa-header-name">{selectedUser.name}</span>
                <span className="wa-header-status">
                  {isTyping
                    ? "typing..."
                    : isOnline
                    ? "online"
                    : lastSeen[String(selectedUser._id)]
                    ? formatLastSeen(lastSeen[String(selectedUser._id)])
                    : selectedUser.role}
                </span>
              </div>
            </div>

            <div className="wa-messages">
              {messages.map((msg, i) => {
                const isMine = String(msg.senderId) === String(currentUserId);
                return (
                  <div key={msg._id || i} className={`wa-bubble-wrap ${isMine ? "mine" : "theirs"}`}>
                    <div className={`wa-bubble ${isMine ? "sent" : "received"}`}>
                      {msg.fileUrl && renderMediaInMessage(msg)}
                      {msg.message && <p className="bubble-text">{msg.message}</p>}
                      <div className="wa-bubble-meta">
                        <span className="wa-time">{formatTime(msg.timestamp)}</span>
                        {isMine && <MessageTicks status={msg.status} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {filePreview && (
              <div className="file-preview-bar">
                {filePreview.type === "image" && <img src={filePreview.localUrl} alt="preview" className="fp-img" />}
                {filePreview.type === "video" && <video src={filePreview.localUrl} className="fp-video" muted />}
                {filePreview.type === "document" && <span className="fp-doc">📄 {filePreview.name}</span>}
                <button className="fp-remove" onClick={() => setFilePreview(null)}>✕</button>
              </div>
            )}

            <div className="wa-input-bar">
              <button
                className="attach-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file, image or video"
                disabled={uploadingFile}
              >
                {uploadingFile ? "⏳" : "📎"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.pptx,.xlsx,.zip"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <textarea
                className="wa-input"
                placeholder="Type a message..."
                value={newMessage}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="wa-send-btn"
                onClick={handleSend}
                disabled={!newMessage.trim() && !filePreview}
              >
                ➤
              </button>
            </div>
          </>
        ) : (
          <div className="wa-empty">
            <div className="wa-empty-icon">💬</div>
            <h3>Select a conversation</h3>
            <p>Choose a contact or team group from the left to start chatting</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default SupervisorChatBox;
