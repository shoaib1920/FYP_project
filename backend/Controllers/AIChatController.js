const AIChatMessage = require("../Models/AIChatMessage");
const { getAIReply } = require("../utils/geminiService");
const { createRateLimiter } = require("../utils/simpleRateLimit");

// Max 10 messages per minute per user — protects the shared free-tier API quota.
const isAllowed = createRateLimiter({ maxRequests: 10, windowMs: 60 * 1000 });

const HISTORY_LIMIT = 20; // messages of context sent to Gemini per turn

// POST /auth/ai/chat
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message is required." });
    }

    if (!isAllowed(String(userId))) {
      return res.status(429).json({
        success: false,
        message: "You're sending messages too quickly. Please wait a moment and try again.",
      });
    }

    const recent = await AIChatMessage.find({ userId })
      .sort({ timestamp: -1 })
      .limit(HISTORY_LIMIT)
      .lean();
    const history = recent.reverse().map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content: message.trim() });

    await AIChatMessage.create({ userId, role: "user", content: message.trim() });

    const reply = await getAIReply(history);

    const saved = await AIChatMessage.create({ userId, role: "assistant", content: reply });

    res.status(200).json({ success: true, reply: saved.content, timestamp: saved.timestamp });
  } catch (error) {
    console.error("AI chat error:", error.message);
    res.status(502).json({ success: false, message: error.message || "AI assistant is unavailable right now." });
  }
};

// GET /auth/ai/history
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const messages = await AIChatMessage.find({ userId }).sort({ timestamp: 1 }).limit(100);
    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("AI history fetch error:", error);
    res.status(500).json({ success: false, message: "Failed to load chat history." });
  }
};

// DELETE /auth/ai/history
exports.clearHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    await AIChatMessage.deleteMany({ userId });
    res.status(200).json({ success: true, message: "Chat history cleared." });
  } catch (error) {
    console.error("AI history clear error:", error);
    res.status(500).json({ success: false, message: "Failed to clear chat history." });
  }
};
