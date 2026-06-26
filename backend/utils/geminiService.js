const SYSTEM_PROMPT = `You are CodeMate, the built-in AI coding assistant inside the FYP (Final Year Project) Management Portal.
You help final-year students with: debugging errors, explaining code, planning implementation approaches, and learning programming concepts relevant to their FYP.

Rules:
- Be concise and practical. Use markdown code blocks for any code.
- You are NOT connected to the student's actual project files — if they want help with specific code, ask them to paste the relevant snippet or error message.
- If a question is ambiguous, ask a brief clarifying question before answering at length.
- Keep a friendly, professional, mentor-like tone — you are helping a student finish their degree project, not just answering trivia.
- Do not claim to take actions inside the portal (you cannot submit, approve, or change anything) — you only provide guidance.`;

const MODEL = "gemini-2.0-flash";

/**
 * Calls the Gemini API with the running conversation and returns the assistant's reply.
 * @param {{role: 'user'|'assistant', content: string}[]} history
 * @returns {Promise<string>}
 */
async function getAIReply(history) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI assistant is not configured (missing GEMINI_API_KEY).");
  }

  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message || `Gemini API error (status ${res.status})`;
    if (res.status === 429) {
      throw new Error("The AI assistant is temporarily busy (rate limit reached). Please try again in a moment.");
    }
    throw new Error(msg);
  }

  const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!reply) {
    throw new Error("The AI assistant did not return a response. Please try rephrasing your question.");
  }
  return reply;
}

const QUALITY_CHECK_PROMPT = `You are reviewing a Final Year Project (FYP) proposal for quality, BEFORE it reaches an academic reviewer.
Assess it on: clarity and specificity of objectives, whether the scope is appropriately sized (not too broad or too narrow), whether the technologies listed are coherent with the stated objectives, and whether the abstract gives a reviewer enough information to judge the idea.

Respond with ONLY a JSON object (no markdown fences, no extra text) in exactly this shape:
{
  "score": <integer 0-100, overall proposal quality>,
  "issues": [<short strings, each one concrete problem found — empty array if none>],
  "suggestions": [<short strings, each one concrete actionable improvement — empty array if none>]
}`;

/**
 * Sends a draft/submitted proposal to Gemini for a structured quality assessment.
 * Never throws on a malformed AI response — falls back to a neutral result instead,
 * since this is an advisory feature and must not block proposal submission.
 * @param {{title:string, category?:string, abstract:string, objectives:string, technologies:string}} proposal
 * @returns {Promise<{score:number, issues:string[], suggestions:string[]}>}
 */
async function analyzeProposalQuality(proposal) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI assistant is not configured (missing GEMINI_API_KEY).");
  }

  const userText = `Title: ${proposal.title}
Category: ${proposal.category || "N/A"}
Abstract: ${proposal.abstract}
Objectives: ${proposal.objectives}
Technologies: ${proposal.technologies}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userText }] }],
      systemInstruction: { parts: [{ text: QUALITY_CHECK_PROMPT }] },
      generationConfig: { temperature: 0.3, maxOutputTokens: 512, responseMimeType: "application/json" },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini API error (status ${res.status})`;
    throw new Error(msg);
  }

  const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  try {
    const parsed = JSON.parse(raw);
    return {
      score: Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 50,
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 8) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 8) : [],
    };
  } catch {
    return { score: 50, issues: [], suggestions: ["The AI quality check returned an unexpected format — review the proposal manually."] };
  }
}

module.exports = { getAIReply, analyzeProposalQuality };
