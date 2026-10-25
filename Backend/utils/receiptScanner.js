// Receipt photo -> Gemini vision -> structured JSON. Koi number khud nahi banata Gemini,
// bas jo likha hai wahi padhta hai; result ko yahan hi validate karte hain.

const MODEL = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const EXPENSE_CATEGORIES = ["Food", "Transportation", "Entertainment", "Bills", "Shopping", "Healthcare", "Education", "Other"];

const SCHEMA = {
  type: "object",
  properties: {
    is_receipt: { type: "boolean", description: "false if the image is not a bill/receipt/invoice" },
    amount: { type: "number", description: "Final total paid, in rupees. Omit if not readable." },
    merchant: { type: "string", description: "Shop or vendor name, if visible" },
    category: { type: "string", enum: EXPENSE_CATEGORIES },
    date: { type: "string", description: "YYYY-MM-DD if printed on the receipt, else omit" },
    confidence: { type: "string", enum: ["high", "low"], description: "low if the total amount is blurry, handwritten, or ambiguous" },
  },
  required: ["is_receipt", "confidence"],
};

const PROMPT =
  "This image may be a shopping receipt, restaurant bill, or invoice. " +
  "If it is, read the FINAL TOTAL amount actually paid (not subtotal, not a single line item) and extract merchant, category and date. " +
  "Pick the closest category from the given options; use Other if unsure. " +
  "If the image is not a receipt/bill, or the total amount is not clearly readable, set is_receipt or confidence accordingly instead of guessing a number. " +
  "Respond with JSON only, matching the schema.";

/**
 * base64: image data (no data: prefix), mimeType: e.g. "image/jpeg"
 * Returns parsed object or null (network/parse failure -> caller shows a generic error).
 */
async function scanReceipt(base64, mimeType) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: PROMPT }, { inlineData: { mimeType, data: base64 } }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) {
      console.error("Receipt scan: Gemini failed", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const finish = data.candidates?.[0]?.finishReason;
    if (finish && finish !== "STOP") {
      console.error("Receipt scan: response cut off", finish);
      return null;
    }
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    const parsed = JSON.parse(text);

    // ---- validate: kabhi bhi galat/invented data aage na jaaye ----
    if (typeof parsed.is_receipt !== "boolean") return null;
    if (!parsed.is_receipt) return { isReceipt: false };

    const amount = Number(parsed.amount);
    const amountOk = Number.isFinite(amount) && amount > 0 && amount <= 1e7;
    const confidence = parsed.confidence === "high" ? "high" : "low";
    const category = EXPENSE_CATEGORIES.includes(parsed.category) ? parsed.category : "Other";
    const merchant = typeof parsed.merchant === "string" ? parsed.merchant.trim().slice(0, 60) : "";
    const date = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;

    return {
      isReceipt: true,
      amountReadable: amountOk,
      amount: amountOk ? Math.round(amount * 100) / 100 : null,
      confidence,
      category,
      merchant,
      date,
    };
  } catch (err) {
    console.error("Receipt scan error:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { scanReceipt, EXPENSE_CATEGORIES };