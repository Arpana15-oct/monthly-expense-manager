const { runBuddy } = require("../utils/buddyAgent.js");
const { scanReceipt } = require("../utils/receiptScanner.js");
const Expense = require("../models/Expense.js");

// POST /api/v1/buddy/chat   body: { messages: [{ role: "user" | "assistant", text }] }
exports.chat = async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ message: "GEMINI_API_KEY is not set on the server." });
    }

    const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const history = raw
      .slice(-12)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        text: String(m.text || "").slice(0, 500),
      }))
      .filter((m) => m.text.trim());

    while (history.length && history[0].role !== "user") history.shift();
    if (!history.length || history[history.length - 1].role !== "user") {
      return res.status(400).json({ message: "Send a message first." });
    }

    const out = await runBuddy({ userId: req.user.id, history });
    if (out.error) {
      return res.status(503).json({ message: "Buddy could not reach Gemini. Check the backend terminal for details." });
    }
    return res.json(out);
  } catch (error) {
    console.error("Buddy chat error:", error.message);
    return res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/v1/buddy/receipt   multipart form field "receipt"
exports.receipt = async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ message: "GEMINI_API_KEY is not set on the server." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No image received." });
    }

    const result = await scanReceipt(req.file.buffer.toString("base64"), req.file.mimetype);
    if (!result) {
      return res.status(503).json({ added: false, message: "Could not read the receipt. Try again or enter it manually." });
    }
    if (!result.isReceipt) {
      return res.json({ added: false, reason: "not_a_receipt", message: "That doesn't look like a receipt or bill. Try a clearer photo, or enter it manually." });
    }
    if (!result.amountReadable) {
      return res.json({ added: false, reason: "unreadable_amount", message: "I can see a receipt but couldn't read the total clearly. Try a clearer photo, or enter it manually." });
    }
    if (result.confidence === "low") {
      return res.json({
        added: false,
        reason: "low_confidence",
        extraction: { amount: result.amount, category: result.category, merchant: result.merchant, date: result.date },
        message: `I think this is ₹${result.amount} (${result.category}), but I'm not fully sure. Add it manually if that looks right.`,
      });
    }

    const date = result.date ? new Date(`${result.date}T00:00:00.000Z`) : new Date();
    const expense = await Expense.create({
      userId: req.user.id,
      category: result.category,
      amount: result.amount,
      date,
    });

    return res.json({
      added: true,
      expense: { _id: expense._id, amount: expense.amount, category: expense.category, date: expense.date },
      merchant: result.merchant || null,
    });
  } catch (error) {
    console.error("Buddy receipt error:", error.message);
    return res.status(500).json({ message: "Server Error" });
  }
};