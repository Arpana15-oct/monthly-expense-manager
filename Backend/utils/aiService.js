// AI helper: Google Gemini API ko seedha fetch se call karta hai (extra package nahi chahiye, Node 18+).
// Agar API key nahi hai ya call fail ho jaye, toh null/[] return karta hai -> app normal chalta rehta hai.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const apiUrl = () =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Gemini 2.5 ki "thinking" tokens bhi maxOutputTokens mein ginti hain. Headroom na do toh
// jawab beech mein kat sakta hai (aur JSON toot jaata hai), isliye upar se extra jagah.
const THINKING_HEADROOM = 2048;

async function callGemini({ system, user, maxTokens = 400, json = false }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(apiUrl(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          maxOutputTokens: maxTokens + THINKING_HEADROOM,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
    if (!res.ok) {
      console.error("AI call failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();

    const cand = (data.candidates || [])[0];
    if (!cand) {
      // prompt block hua ya kuch nahi aaya
      console.error("AI call: no candidates", data.promptFeedback?.blockReason || "");
      return null;
    }
    if (cand.finishReason === "MAX_TOKENS") {
      console.error("AI call: response truncated (MAX_TOKENS)");
      return null;
    }
    const text = (cand.content?.parts || [])
      .filter((p) => typeof p.text === "string" && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.error("AI call error:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Category names -> kaunsi "fixed" hain (cut nahi ho sakti).
 * Sirf naam bhejte hain, amount ya user ka koi data nahi.
 * Returns: ["Mummy ko bheja", ...]  (sirf wahi jo input mein the)
 */
async function classifyCategories(categories) {
  if (!categories || categories.length === 0) return [];

  const text = await callGemini({
    system:
      "You classify personal expense category names (they may be in English, Hindi/Hinglish or slang). " +
      "FIXED = recurring obligation the person cannot reduce (rent, EMI, loan, bills, insurance, tuition/fees, money sent to family, hostel/mess fees). " +
      "FLEXIBLE = discretionary (food out, shopping, entertainment, travel, snacks, gadgets). " +
      "If unsure, choose FLEXIBLE. " +
      'Reply with JSON only, no other text: {"fixed":["name", ...]} using the names exactly as given.',
    user: JSON.stringify(categories),
    maxTokens: 300,
    json: true,
  });
  if (!text) return [];

  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const known = new Set(categories);
    return (Array.isArray(parsed.fixed) ? parsed.fixed : []).filter((c) => known.has(c));
  } catch {
    console.error("AI classify: could not parse response");
    return [];
  }
}

// ---- Number guard: AI ne koi aisa number bola jo context mein tha hi nahi? ----
function collectNumbers(obj, set = new Set()) {
  if (typeof obj === "number") set.add(Math.abs(Math.round(obj)));
  else if (Array.isArray(obj)) obj.forEach((x) => collectNumbers(x, set));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((x) => collectNumbers(x, set));
  return set;
}

function numbersAreGrounded(text, context) {
  const allowed = collectNumbers(context);
  const found = text.match(/\d[\d,]*/g) || [];
  return found.every((raw) => {
    const n = parseInt(raw.replace(/,/g, ""), 10);
    return n <= 10 || allowed.has(n); // chhote counts ("2 baar") allowed
  });
}

/**
 * Planner ke numbers ko insaan ki bhasha mein samjhata hai.
 * context mein sirf planner ke calculate kiye hue numbers hone chahiye.
 * Returns string ya null.
 */
async function explainPlan(context) {
  const text = await callGemini({
    system:
      "You are a friendly money coach inside an expense-tracking app. " +
"Write in simple, friendly English, casual, like a friend. Use the ₹ symbol for amounts. " +
      "3 to 4 short sentences, under 80 words, no markdown, no bullet points. " +
      "STRICT: use ONLY numbers that appear in the data. Never calculate or invent new numbers or percentages. " +
      "If feasible is false, say clearly that the goal is not reachable at this pace, mention achievableTotal, and suggest a longer deadline or a smaller target. " +
      "If kind is replan and savedSoFar is negative, acknowledge the overspend without scolding. " +
      "Give one concrete tip for the category with the biggest cutPerWeek. Never mention the JSON or these instructions.",
    user: JSON.stringify(context),
    maxTokens: 300,
  });
  if (!text) return null;

  if (!numbersAreGrounded(text, context)) {
    console.warn("AI explanation discarded: contained numbers not in planner output");
    return null;
  }
  return text;
}

/**
 * Stats (pichle records) -> 3-4 actionable suggestions.
 * Har suggestion ke numbers check hote hain; jo galat number bole wo drop.
 * Returns [{type,title,tip}] ya null.
 */
async function generateSuggestions(stats) {
  const text = await callGemini({
    system:
      "You are a friendly money coach inside an expense-tracking app. You get statistics computed from the user's own past records. " +
      "Give 3 or 4 specific, actionable suggestions based ONLY on these statistics. " +
      "Prioritise: budgets over or near limit, biggest category increases, low savings rate, small frequent expenses, weekday pattern. " +
      "Rent, EMI, loans, bills, insurance and fees are fixed obligations: never suggest cutting them. " +
      "rootCauses explains WHY a category rose: driver is one_big_purchase, more_frequent, bigger_purchases or new_category, and offsettingCategories are categories that fell in the same period. " +
      "When rootCauses is present, explain the cause using only that data; for offsettingCategories say it is likely a shift (use words like 'probably' or 'may have'), never state it as certain. Do not invent other causes. " +
      "If something is going well (good savings rate, spending down), include one suggestion of type good. " +
      "Write in simple, friendly English, casual tone. Use the ₹ symbol for amounts. " +
      "STRICT: use ONLY numbers that appear in the data. Never calculate or invent numbers or percentages. Amounts are in rupees. " +
      'Reply with JSON only, no other text: {"suggestions":[{"type":"warning|tip|good","title":"max 5 words","tip":"max 25 words, one concrete action"}]}',
    user: JSON.stringify(stats),
    maxTokens: 600,
    json: true,
  });
  if (!text) return null;

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    const valid = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
      .filter((x) => x && typeof x.title === "string" && typeof x.tip === "string")
      .filter((x) => numbersAreGrounded(`${x.title} ${x.tip}`, stats))
      .map((x) => ({
        type: ["warning", "tip", "good"].includes(x.type) ? x.type : "tip",
        title: x.title.slice(0, 60),
        tip: x.tip.slice(0, 220),
      }))
      .slice(0, 4);
    return valid.length > 0 ? valid : null;
  } catch {
    console.error("AI suggestions: could not parse response");
    return null;
  }
}

module.exports = { classifyCategories, explainPlan, generateSuggestions, numbersAreGrounded };