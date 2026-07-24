import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { FaComments } from "react-icons/fa";
import { resolveFileUrl } from "../../../utils/resolveFileUrl";
import "./Message.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

let adminSocketInstance = null;

function getSocket(token) {
  if (!adminSocketInstance || !adminSocketInstance.connected) {
    adminSocketInstance = io(API, {
      auth: { token },
      transports: ["polling"],
      reconnectionAttempts: 5,
    });
  }
  return adminSocketInstance;
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

const AdminChatBox = () => {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserName, setCurrentUserName] = useState("Admin");
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
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [socket, setSocket] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("chats"); // "chats" | "department"

  // Department-wide chat (admin belongs to ALL departments, for moderation)
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [deptMessages, setDeptMessages] = useState([]);
  const [deptTypingUsers, setDeptTypingUsers] = useState(new Map());
  const [deptNotice, setDeptNotice] = useState("");
  const [showModeration, setShowModeration] = useState(false);
  const [moderationMembers, setModerationMembers] = useState([]);
  const [moderationLoading, setModerationLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const selectedDepartmentRef = useRef(null);

  useEffect(() => { selectedDepartmentRef.current = selectedDepartment; }, [selectedDepartment]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Load admin identity
  useEffect(() => {
    const adminData = localStorage.getItem("adminData");
    const tok = localStorage.getItem("adminToken");
    if (adminData && tok) {
      try {
        const parsed = JSON.parse(adminData);
        const admin = parsed.admin || parsed;
        setCurrentUserId(admin._id || admin.id);
        setCurrentUserName(admin.name || "Admin");
        setToken(tok);
      } catch {}
    }
  }, []);

  // Init socket with adminToken
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
      sock.off("receive_dept_message");
      sock.off("dept_message_rejected");
      sock.off("dept_user_typing");
      sock.off("dept_user_stop_typing");
    };
  }, [token, currentUserId]);

  // Load department chats (admin belongs to all of them)
  useEffect(() => {
    if (!currentUserId || !token) return;
    const fetchDepartments = async () => {
      try {
        const res = await axios.get(`${API}/auth/department-chat/my-departments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDepartments(res.data.departments || []);
      } catch (err) {
        console.error("Failed to load department chats:", err);
      }
    };
    fetchDepartments();
  }, [currentUserId, token]);

  // Load messages when selecting a department chat
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

  const openDepartment = (dept) => {
    setSelectedUser(null);
    setShowModeration(false);
    setSelectedDepartment(dept);
  };

  const fetchModerationMembers = async () => {
    if (!selectedDepartment || !token) return;
    setModerationLoading(true);
    try {
      const res = await axios.get(
        `${API}/auth/admin/department-chat/${selectedDepartment._id}/members`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setModerationMembers(res.data.members || []);
    } catch (err) {
      console.error("Failed to load department members:", err);
    } finally {
      setModerationLoading(false);
    }
  };

  const toggleModerationPanel = () => {
    const next = !showModeration;
    setShowModeration(next);
    if (next) fetchModerationMembers();
  };

  const handleModerate = async (member, action) => {
    try {
      await axios.put(
        `${API}/auth/admin/department-chat/${selectedDepartment._id}/${action}/${member._id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchModerationMembers();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action} member.`);
    }
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
      senderRole: "Admin",
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
      senderRole: "Admin",
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

  // Load contacts: all students + all supervisors
  useEffect(() => {
    if (!currentUserId) return;
    const fetchContacts = async () => {
      try {
        const [studentsRes, supervisorsRes] = await Promise.all([
          axios.get(`${API}/auth/users`),
          axios.get(`${API}/auth/supervisors`),
        ]);
        const students = (studentsRes.data.users || studentsRes.data || []).map((u) => ({
          ...u,
          role: "Student",
        }));
        const supervisors = (supervisorsRes.data.supervisors || supervisorsRes.data || []).map(
          (s) => ({ ...s, role: "Supervisor" })
        );
        const combined = [...students, ...supervisors].filter(
          (u) => String(u._id) !== String(currentUserId)
        );
        setContacts(combined);
        setFilteredContacts(combined);
      } catch (err) {
        console.error("Failed to load contacts:", err);
      }
    };
    fetchContacts();
  }, [currentUserId]);

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

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!socket) return;
    if (selectedDepartment) {
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

  const handleSend = () => {
    if (selectedDepartment) handleSendDeptMessage();
    else handleSendMessage();
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
      setFilePreview({ url: fileUrl, name: fileName, size: fileSize, type: fileType, localUrl: URL.createObjectURL(file) });
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
            className={`wa-tab-btn ${sidebarTab === "department" ? "active" : ""}`}
            onClick={() => setSidebarTab("department")}
          >
            Groups{departments.length > 0 ? ` (${departments.length})` : ""}
          </button>
        </div>

        {sidebarTab === "department" ? (
          <div className="wa-contact-list wa-group-list">
            {departments.length === 0 ? (
              <div className="wa-empty-tab">No groups yet.</div>
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
                    onClick={() => { setSelectedDepartment(null); setSelectedUser(user); }}
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
                <div style={{ padding: "20px 16px", color: "#9ca3af", fontSize: "0.85rem" }}>
                  No contacts found.
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
              <button
                onClick={toggleModerationPanel}
                style={{
                  marginLeft: "auto", background: showModeration ? "#4c1d95" : "#f5f3ff",
                  color: showModeration ? "#fff" : "#5b21b6", border: "1px solid #ddd6fe",
                  borderRadius: "8px", padding: "6px 12px", fontSize: "12.5px", fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                {showModeration ? "Hide Members" : "Manage Members"}
              </button>
            </div>

            {showModeration && (
              <div style={{ borderBottom: "1px solid #e5e7eb", maxHeight: "220px", overflowY: "auto", padding: "10px 16px" }}>
                {moderationLoading ? (
                  <p style={{ fontSize: "13px", color: "#6b7280" }}>Loading members...</p>
                ) : moderationMembers.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#6b7280" }}>No members found.</p>
                ) : (
                  moderationMembers.map((m) => (
                    <div key={m._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <div>
                        <span style={{ fontSize: "13.5px", fontWeight: "600", color: "#1f2937" }}>{m.name}</span>
                        <span style={{ fontSize: "11.5px", color: "#9ca3af", marginLeft: "6px" }}>{m.role}</span>
                        {m.muted && <span style={{ fontSize: "10.5px", color: "#92400e", background: "#fef3c7", borderRadius: "999px", padding: "1px 8px", marginLeft: "6px" }}>Muted</span>}
                        {m.excluded && <span style={{ fontSize: "10.5px", color: "#b91c1c", background: "#fee2e2", borderRadius: "999px", padding: "1px 8px", marginLeft: "6px" }}>Excluded</span>}
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => handleModerate(m, m.muted ? "unmute" : "mute")}
                          style={{ background: "transparent", border: "1px solid #fde68a", color: "#92400e", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
                        >
                          {m.muted ? "Unmute" : "Mute"}
                        </button>
                        <button
                          onClick={() => handleModerate(m, m.excluded ? "restore" : "exclude")}
                          style={{ background: "transparent", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
                        >
                          {m.excluded ? "Restore" : "Exclude"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

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
                onClick={handleSendMessage}
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
            <p>Choose a contact from the left to start chatting</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default AdminChatBox;
