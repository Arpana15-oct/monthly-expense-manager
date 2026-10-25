const Expense = require("../models/Expense.js");
const Income = require("../models/Income.js");
const Budget = require("../models/Budget.js");
const { buildInsightStats, ruleBasedSuggestions } = require("../utils/insightStats.js");
const { generateSuggestions } = require("../utils/aiService.js");

// Har click pe AI call na ho (paisa + time), isliye 10 min ka chhota cache
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map(); // userId -> { at, payload }

// GET /api/v1/insights/suggestions   (?refresh=1 se cache skip)
exports.getSuggestions = async (req, res) => {
  const userId = req.user.id;
  try {
    const cached = cache.get(userId);
    if (!req.query.refresh && cached && Date.now() - cached.at < CACHE_MS) {
      return res.json({ ...cached.payload, cached: true });
    }

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [expenses, incomes, budgets] = await Promise.all([
      Expense.find({ userId, date: { $gte: since } }),
      Income.find({ userId, date: { $gte: since } }),
      Budget.find({ userId }),
    ]);

    const stats = buildInsightStats({ expenses, incomes, budgets });

    if (!stats.enoughData) {
      return res.json({
        suggestions: [],
        source: "none",
        message: " No active records right now. Add some expenses to use this.",
      });
    }

    let suggestions = await generateSuggestions(stats);
    let source = "ai";
    if (!suggestions) {
      suggestions = ruleBasedSuggestions(stats);
      source = "rules";
    }

    const payload = { suggestions, source, generatedAt: new Date().toISOString() };
    cache.set(userId, { at: Date.now(), payload });
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};