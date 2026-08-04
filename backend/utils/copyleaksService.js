const axios = require("axios");

const AUTH_URL = "https://id.copyleaks.com/v3/account/login/api";
const DETECTOR_URL = "https://api.copyleaks.com/v2/writer-detector";
const MIN_CHARS = 255; // Copyleaks' own minimum — shorter requests are rejected outright
const MAX_CHARS = 6000; // keep each check's credit cost bounded, same budget as the OpenRouter check

let cachedToken = null;
let cachedTokenExpiresAt = 0;

// Copyleaks access tokens last ~48h — cache in memory and only refetch when
// actually close to expiry, instead of authenticating on every request.
async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;

  const email = process.env.COPYLEAKS_EMAIL;
  const key = process.env.COPYLEAKS_API_KEY;
  if (!email || !key) throw new Error("Copyleaks is not configured (missing COPYLEAKS_EMAIL/COPYLEAKS_API_KEY).");

  const response = await axios.post(AUTH_URL, { email, key }, { timeout: 15000 });
  cachedToken = response.data.access_token;
  // Refresh 10 minutes early rather than cutting it exactly at expiry
  cachedTokenExpiresAt = Date.now() + 47.5 * 60 * 60 * 1000;
  return cachedToken;
}

/**
 * Runs a final report's text through Copyleaks' AI Content Detector — a
 * dedicated ML model for AI-vs-human authorship, distinct from (and a second
 * opinion alongside) the OpenRouter LLM-based heuristic already in place.
 * This trial key is scoped to the AI Detector product only, not Copyleaks'
 * full internet-plagiarism-matching product. Best-effort: never throws,
 * returns null on any failure so it can't block report submission/grading.
 * @param {string} text - extracted plain text from the report PDF
 * @param {string} scanId - unique id for this check (e.g. the project id)
 * @returns {Promise<{aiPercentage:number, humanPercentage:number, checkedAt:Date}|null>}
 */
async function checkAiContent(text, scanId) {
  const trimmed = (text || "").trim();
  if (trimmed.length < MIN_CHARS) return null; // too short for Copyleaks to score

  try {
    const token = await getAccessToken();
    const response = await axios.post(
      `${DETECTOR_URL}/${encodeURIComponent(scanId)}/check`,
      { text: trimmed.slice(0, MAX_CHARS) },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 }
    );

    const summary = response.data?.summary || {};
    return {
      aiPercentage: Number.isFinite(summary.ai) ? Math.round(summary.ai * 100) : null,
      humanPercentage: Number.isFinite(summary.human) ? Math.round(summary.human * 100) : null,
      checkedAt: new Date(),
    };
  } catch (err) {
    console.error("Copyleaks AI check failed:", err?.response?.data?.error?.message || err.message);
    return null;
  }
}

module.exports = { checkAiContent, MIN_CHARS };
