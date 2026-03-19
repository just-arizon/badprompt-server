// controllers/analyzePrompt.js

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Rate limiter 
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT) return true;

  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_WINDOW_MS) rateLimitMap.delete(ip);
  }
}, 5 * 60_000);

// System prompt 
const SYSTEM_PROMPT = `You are a prompt quality expert. Analyze the given prompt and respond ONLY with valid JSON (no markdown, no backticks, no explanation outside JSON).

Return this exact structure:
{
  "overallScore": <0-100 integer>,
  "clarity": <0-100 integer>,
  "specificity": <0-100 integer>,
  "context": <0-100 integer>,
  "issues": [
    "<concise issue description>",
    "<concise issue description>"
  ],
  "improvedPrompt": "<the rewritten, high-quality prompt>"
}

Scoring guide:
- overallScore: holistic quality
- clarity: how unambiguous the intent is
- specificity: how detailed/precise the request is
- context: how much relevant background is provided

issues: list 2-4 specific problems with the prompt (be concrete, not generic)
improvedPrompt: rewrite it as an expert would — with clear role, context, constraints, output format if relevant, and specific ask. Make it genuinely better, not just longer.`;

// Controller 
export const analyzePrompt = async function (req, res) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Try again in a minute." });
  }

  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Request body must include a `prompt` string." });
  }

  const trimmed = prompt.trim();

  if (trimmed.length < 3) {
    return res.status(400).json({ error: "Prompt is too short to analyze." });
  }

  if (trimmed.length > 4000) {
    return res.status(400).json({ error: "Prompt exceeds 4000 character limit." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    return res.status(500).json({ error: "Server misconfiguration." });
  }

  let anthropicRes;
  try {
    anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Analyze this prompt: "${trimmed}"` }],
      }),
    });
  } catch (networkErr) {
    console.error("Network error calling Anthropic:", networkErr);
    return res.status(502).json({ error: "Failed to reach Anthropic API." });
  }

  if (!anthropicRes.ok) {
    const body = await anthropicRes.text().catch(() => "");
    console.error(`Anthropic API error ${anthropicRes.status}:`, body);
    return res.status(502).json({ error: `Anthropic API returned ${anthropicRes.status}.` });
  }

  let data;
  try {
    data = await anthropicRes.json();
  } catch {
    return res.status(502).json({ error: "Invalid JSON from Anthropic API." });
  }

  const rawText = (data.content || [])
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .replace(/```json|```/g, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error("Failed to parse model JSON:", rawText);
    return res.status(500).json({ error: "Model returned malformed JSON." });
  }

  const { overallScore, clarity, specificity, context, issues, improvedPrompt } = parsed;

  if (
    typeof overallScore !== "number" ||
    typeof clarity !== "number" ||
    typeof specificity !== "number" ||
    typeof context !== "number" ||
    !Array.isArray(issues) ||
    typeof improvedPrompt !== "string"
  ) {
    console.error("Unexpected model response shape:", parsed);
    return res.status(500).json({ error: "Unexpected response shape from model." });
  }

  return res.json({ overallScore, clarity, specificity, context, issues, improvedPrompt });
};