import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import { FaRobot, FaTimes, FaPaperPlane, FaTrash } from "react-icons/fa";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Splits a message into plain-text / fenced-code-block segments for basic markdown rendering.
function renderContent(content) {
  const parts = content.split(/```(\w*\n[\s\S]*?)```/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const lines = part.split("\n");
      const code = lines.slice(1).join("\n");
      return (
        <pre key={i} className={styles.codeBlock}>
          <code>{code}</code>
        </pre>
      );
    }
    return part.split("\n").map((line, j) => (
      <React.Fragment key={`${i}-${j}`}>
        {line}
        {j < part.split("\n").length - 1 && <br />}
      </React.Fragment>
    ));
  });
}

const AIAssistant = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesRef = useRef(null);

  const getToken = () => localStorage.getItem("token");

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, sending, scrollToBottom]);

  useEffect(() => {
    if (!open || historyLoaded) return;
    const token = getToken();
    if (!token) return;
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API}/auth/ai/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(res.data.messages || []);
      } catch (err) {
        console.error("Failed to load AI chat history:", err);
      } finally {
        setHistoryLoaded(true);
      }
    };
    fetchHistory();
  }, [open, historyLoaded]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const token = getToken();
    if (!token) {
      setError("Please log in to use the AI assistant.");
      return;
    }

    setError("");
    const optimisticUser = { role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");
    setSending(true);

    try {
      const res = await axios.post(
        `${API}/auth/ai/chat`,
        { message: text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply, timestamp: res.data.timestamp }]);
    } catch (err) {
      setError(err.response?.data?.message || "The AI assistant is unavailable right now.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = async () => {
    const token = getToken();
    if (!token) return;
    try {
      await axios.delete(`${API}/auth/ai/history`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages([]);
    } catch (err) {
      console.error("Failed to clear AI chat history:", err);
    }
  };

  return (
    <>
      <button
        className={styles.fab}
        onClick={() => setOpen((prev) => !prev)}
        title="AI Coding Assistant"
        aria-label="Open AI coding assistant"
      >
        {open ? <FaTimes /> : <FaRobot />}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.headerInfo}>
              <FaRobot className={styles.headerIcon} />
              <div>
                <h4>CodeMate</h4>
                <span>AI coding assistant</span>
              </div>
            </div>
            <button className={styles.iconBtn} onClick={handleClear} title="Start a new conversation">
              <FaTrash />
            </button>
          </div>

          <div className={styles.messages} ref={messagesRef}>
            {messages.length === 0 && (
              <div className={styles.emptyState}>
                <FaRobot className={styles.emptyIcon} />
                <p>Hi! I'm CodeMate. Ask me about a bug, an error message, or how to approach a feature for your project.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`${styles.bubbleWrap} ${msg.role === "user" ? styles.mine : styles.theirs}`}>
                <div className={`${styles.bubble} ${msg.role === "user" ? styles.sent : styles.received}`}>
                  <div className={styles.bubbleText}>{renderContent(msg.content)}</div>
                  <span className={styles.time}>{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))}
            {sending && (
              <div className={`${styles.bubbleWrap} ${styles.theirs}`}>
                <div className={`${styles.bubble} ${styles.received}`}>
                  <span className={styles.typingDots}>
                    <span></span><span></span><span></span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && <div className={styles.errorBar}>{error}</div>}

          <div className={styles.inputBar}>
            <textarea
              placeholder="Ask about an error, a bug, or your code..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending}
            />
            <button onClick={handleSend} disabled={!input.trim() || sending} title="Send">
              <FaPaperPlane />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
