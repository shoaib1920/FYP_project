const axios = require("axios");

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";
const CHAT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
const QUALITY_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

const SYSTEM_PROMPT = `You are CodeMate, the built-in AI coding assistant inside the FYP (Final Year Project) Management Portal.
You help final-year students with: debugging errors, explaining code, planning implementation approaches, and learning programming concepts relevant to their FYP.

Rules:
- Be concise and practical. Use markdown code blocks for any code.
- You are NOT connected to the student's actual project files — if they want help with specific code, ask them to paste the relevant snippet or error message.
- If a question is ambiguous, ask a brief clarifying question before answering at length.
- Keep a friendly, professional, mentor-like tone — you are helping a student finish their degree project, not just answering trivia.
- Do not claim to take actions inside the portal (you cannot submit, approve, or change anything) — you only provide guidance.`;

function getApiKey() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("AI assistant is not configured (missing OPENROUTER_API_KEY).");
  return apiKey;
}

function buildHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:3000",
    "X-Title": "FYP Management Portal",
  };
}

function handleAxiosError(err) {
  const status = err?.response?.status;
  if (status === 429) {
    throw new Error("AI rate limit reached — please wait 30 seconds and try again.");
  }
  if (status === 401 || status === 403) {
    throw new Error("AI API key is invalid or unauthorized. Contact the administrator.");
  }
  const msg = err?.response?.data?.error?.message || err.message;
  throw new Error(msg || "AI service unavailable. Please try again later.");
}

/**
 * Calls OpenRouter with the running conversation and returns the assistant's reply.
 * @param {{role: 'user'|'assistant', content: string}[]} history
 * @returns {Promise<string>}
 */
async function getAIReply(history) {
  const apiKey = getApiKey();
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  let response;
  try {
    response = await axios.post(
      OPENROUTER_BASE,
      { model: CHAT_MODEL, messages, temperature: 0.6, max_tokens: 1024 },
      { headers: buildHeaders(apiKey), timeout: 30000 }
    );
  } catch (err) {
    handleAxiosError(err);
  }

  const reply = response.data?.choices?.[0]?.message?.content || "";
  if (!reply) throw new Error("The AI assistant did not return a response. Please try rephrasing your question.");
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
 * Sends a proposal to OpenRouter for a structured quality assessment.
 * Never throws on a malformed AI response — falls back to a neutral result.
 * @param {{title:string, category?:string, abstract:string, objectives:string, technologies:string}} proposal
 * @returns {Promise<{score:number, issues:string[], suggestions:string[]}>}
 */
async function analyzeProposalQuality(proposal) {
  const apiKey = getApiKey();
  const userText = `Title: ${proposal.title}
Category: ${proposal.category || "N/A"}
Abstract: ${proposal.abstract}
Objectives: ${proposal.objectives}
Technologies: ${proposal.technologies}`;

  let response;
  try {
    response = await axios.post(
      OPENROUTER_BASE,
      {
        model: QUALITY_MODEL,
        messages: [
          { role: "system", content: QUALITY_CHECK_PROMPT },
          { role: "user", content: userText },
        ],
        temperature: 0.3,
        max_tokens: 512,
      },
      { headers: buildHeaders(apiKey), timeout: 30000 }
    );
  } catch (err) {
    handleAxiosError(err);
  }

  const raw = response.data?.choices?.[0]?.message?.content || "";
  try {
    // Strip markdown code fences that some models add despite json_object instruction
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      score: Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 50,
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 8) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 8) : [],
    };
  } catch {
    return { score: 50, issues: [], suggestions: [] };
  }
}

const REPORT_QUALITY_CHECK_PROMPT = `You are reviewing the final submitted report of a Final Year Project (FYP), BEFORE the supervisor grades it — you are giving them a second opinion to assist grading, not making the grading decision yourself.

Assess it on: structural completeness (does it read like it has an introduction, methodology/implementation, results/evaluation, and conclusion — even if section headings differ), depth vs superficiality (is content specific to this project or generic/templated boilerplate that could apply to any project), internal consistency (does the writing style/quality stay consistent throughout, which can hint at copy-pasted sections), and overall academic writing quality.

You are NOT a plagiarism-detection database and have no access to other documents to compare against — do not claim to have found a match elsewhere. Only flag ORIGINALITY CONCERNS you can actually observe from THIS text alone: abrupt style/tone shifts between sections, generic filler language, sections that don't connect to the rest of the report, or content that reads as copied from documentation/tutorials rather than describing the student's own work.

Additionally, assess how likely the text is to be AI-generated or heavily AI-drafted rather than written by the student. Base this only on observable writing signals: unnaturally uniform sentence length/rhythm, low vocabulary variety, overuse of stock transitional phrases ("furthermore", "moreover", "it is important to note", "in conclusion", "delve", "tapestry", "boast"), generic statements lacking project-specific detail, and an absence of the small inconsistencies typical of human writing. This is a heuristic judgment call, not a certified detector — you may be wrong, so only flag passages you can point to a concrete textual reason for, and do not claim certainty.

Respond with ONLY a JSON object (no markdown fences, no extra text) in exactly this shape:
{
  "score": <integer 0-100, overall report quality>,
  "issues": [<short strings, each one concrete problem found — empty array if none>],
  "suggestions": [<short strings, each one concrete actionable improvement for the supervisor to consider — empty array if none>],
  "originalityConcerns": [<short strings, each a specific observed originality/consistency red flag as described above — empty array if none found>],
  "aiGenerated": {
    "likelihoodScore": <integer 0-100, how likely this text is AI-generated/AI-drafted per the guidance above>,
    "flaggedPassages": [{"text": <short exact quoted snippet, 1-2 sentences, from the text>, "reason": <short specific reason this snippet reads as AI-generated>}] (empty array if none found, max 5)
  }
}`;

/**
 * Sends extracted final-report text to OpenRouter for a structured quality
 * assessment — same model/service as the proposal quality check, with a
 * report-specific prompt. This is an AI content-quality signal for the
 * supervisor (including an AI-generated-content heuristic), not a
 * plagiarism-database match.
 * @param {string} reportText - extracted plain text from the report PDF
 * @returns {Promise<{score:number, issues:string[], suggestions:string[], originalityConcerns:string[], aiGenerated:{likelihoodScore:number, flaggedPassages:{text:string,reason:string}[]}}>}
 */
async function analyzeFinalReportQuality(reportText) {
  const apiKey = getApiKey();
  // Cap input to stay within the free model's context/cost budget and keep
  // response times low enough to avoid the free tier's request timeout — a
  // report can run to dozens of pages, so this is a representative sample
  // (opening pages), not the full document. Kept intentionally small since
  // this call now also does AI-generated-content analysis on top of the
  // original quality check, which already pushes response time up.
  const MAX_CHARS = 6000;
  const truncated = reportText.length > MAX_CHARS;
  const userText = `${truncated ? "[Note: report truncated to the first ~6,000 characters for review]\n\n" : ""}${reportText.slice(0, MAX_CHARS)}`;

  let response;
  try {
    response = await axios.post(
      OPENROUTER_BASE,
      {
        model: QUALITY_MODEL,
        messages: [
          { role: "system", content: REPORT_QUALITY_CHECK_PROMPT },
          { role: "user", content: userText },
        ],
        temperature: 0.3,
        max_tokens: 900,
      },
      { headers: buildHeaders(apiKey), timeout: 45000 }
    );
  } catch (err) {
    handleAxiosError(err);
  }

  const raw = response.data?.choices?.[0]?.message?.content || "";
  const defaultAiGenerated = { likelihoodScore: null, flaggedPassages: [] };
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const aiGeneratedRaw = parsed.aiGenerated || {};
    return {
      score: Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 50,
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 8) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 8) : [],
      originalityConcerns: Array.isArray(parsed.originalityConcerns) ? parsed.originalityConcerns.slice(0, 8) : [],
      aiGenerated: {
        likelihoodScore: Number.isFinite(aiGeneratedRaw.likelihoodScore)
          ? Math.max(0, Math.min(100, Math.round(aiGeneratedRaw.likelihoodScore)))
          : null,
        flaggedPassages: Array.isArray(aiGeneratedRaw.flaggedPassages)
          ? aiGeneratedRaw.flaggedPassages
              .filter((p) => p && typeof p.text === "string")
              .slice(0, 5)
              .map((p) => ({ text: p.text, reason: typeof p.reason === "string" ? p.reason : "" }))
          : [],
      },
    };
  } catch {
    return { score: 50, issues: [], suggestions: [], originalityConcerns: [], aiGenerated: defaultAiGenerated };
  }
}

module.exports = { getAIReply, analyzeProposalQuality, analyzeFinalReportQuality };
