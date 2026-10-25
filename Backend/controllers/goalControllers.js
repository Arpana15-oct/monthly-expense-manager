const Goal = require("../models/Goal.js");
const Expense = require("../models/Expense.js");
const { buildPlan, replan, isFixed } = require("../utils/goalPlanner.js");
const { classifyCategories, explainPlan } = require("../utils/aiService.js");

// baseline + limits ko ek saath dikhane layak banata hai (AI ko numbers ready milte hain)
const categoryView = (baseline, targets) =>
  baseline.map((b) => {
    const t = targets.find((x) => x.category === b.category);
    const limit = t ? t.limit : b.weeklyAvg;
    return {
      category: b.category,
      normalWeekly: b.weeklyAvg,
      newLimit: limit,
      cutPerWeek: b.weeklyAvg - limit,
    };
  });

const STALE_MS = 60 * 60 * 1000; // 1 ghante se purana plan auto-refresh hoga

// Ek goal pe replan chalao aur document update karo (save caller karega)
const applyReplan = (goal, expenses, now = new Date()) => {
  const relevant = expenses.filter((e) => new Date(e.date) >= goal.startDate);
  const result = replan({ goal: goal.toObject(), expenses: relevant, now });
  goal.weeklyPlan = result.weeklyPlan;
  goal.savedSoFar = result.savedSoFar;
  goal.status = result.status;
  goal.feasible = result.feasible;
  goal.achievableTotal = result.achievableTotal;
  goal.lastReplannedAt = now;
  goal.lastReport = {
    weeksDone: result.weeksDone,
    remainingWeeks: result.remainingWeeks,
    remainingAmount: result.remainingAmount,
    neededPerWeek: result.neededPerWeek,
  };
  return result;
};

// POST /api/v1/goal/add
exports.addGoal = async (req, res) => {
  const userId = req.user.id;
  try {
    const { title, targetAmount, startDate, endDate, fixedCategories } = req.body || {};

    if (!title || !targetAmount || !endDate) {
      return res.status(400).json({ message: "title, targetAmount and endDate are required" });
    }

    const start = startDate ? new Date(startDate) : new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    const target = parseFloat(targetAmount);
    const fixed = Array.isArray(fixedCategories) ? fixedCategories : [];

    if (isNaN(target) || target <= 0) {
      return res.status(400).json({ message: "targetAmount must be a positive number" });
    }
    if (isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ message: "endDate must be after startDate" });
    }

    const since = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);
    const expenses = await Expense.find({ userId, date: { $gte: since } });

    if (expenses.length === 0) {
      return res.status(400).json({
        message: "Not enough expense history to build a plan. Add some expenses first.",
      });
    }

    // AI se poochho: naam dekh ke kaunsi extra categories fixed hain (keyword se jo pakde nahi gaye)
    const allCategories = [...new Set(expenses.map((e) => e.category))];
    const unknown = allCategories.filter((c) => !isFixed(c, fixed));
    const aiFixed = await classifyCategories(unknown);
    const allFixed = [...new Set([...fixed, ...aiFixed])];

    const plan = buildPlan({
      expenses,
      targetAmount: target,
      startDate: start,
      endDate: end,
      fixedCategories: allFixed,
    });

    if (plan.baseline.length === 0) {
      return res.status(400).json({
        message: "No flexible spending found (only fixed categories like rent/bills).",
      });
    }

    const aiNote = await explainPlan({
      kind: "new_goal",
      title,
      targetAmount: target,
      weeksCount: plan.weeksCount,
      feasible: plan.feasible,
      weeklySavingNeeded: plan.weeklySaving,
      achievableTotal: plan.achievableTotal,
      categories: categoryView(plan.baseline, plan.weeklyPlan[0].categoryTargets),
    });

    const goal = await Goal.create({
      userId,
      title,
      targetAmount: target,
      startDate: start,
      endDate: end,
      feasible: plan.feasible,
      achievableTotal: plan.achievableTotal,
      fixedCategories: allFixed,
      baseline: plan.baseline,
      weeklyPlan: plan.weeklyPlan,
      aiNote: aiNote || undefined,
    });

    return res.status(200).json({
      goal,
      summary: {
        feasible: plan.feasible,
        weeksCount: plan.weeksCount,
        weeklySavingNeeded: plan.weeklySaving,
        weeklyBaseline: plan.weeklyBaseline,
        achievableTotal: plan.achievableTotal,
        fixedCategoriesDetected: allFixed,
      },
      aiNote: aiNote || null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

// GET /api/v1/goal/get  (active goals ka purana plan yahin auto-refresh ho jaata hai, AI ke bina)
exports.getGoals = async (req, res) => {
  const userId = req.user.id;
  try {
    const goals = await Goal.find({ userId }).sort({ createdAt: -1 });
    const now = new Date();

    const stale = goals.filter(
      (g) =>
        g.status === "active" &&
        g.baseline &&
        g.baseline.length > 0 &&
        (!g.lastReplannedAt || now - g.lastReplannedAt > STALE_MS)
    );

    if (stale.length > 0) {
      const earliest = new Date(Math.min(...stale.map((g) => g.startDate.getTime())));
      const expenses = await Expense.find({ userId, date: { $gte: earliest } });
      for (const g of stale) {
        applyReplan(g, expenses, now);
        await g.save();
      }
    }

    res.json(goals);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/v1/goal/:id/replan
exports.replanGoal = async (req, res) => {
  const userId = req.user.id;
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId });
    if (!goal) {
      return res.status(404).json({ message: "Goal not found or not authorized" });
    }
    if (!goal.baseline || goal.baseline.length === 0) {
      return res.status(400).json({
        message: "This goal was created with an older version. Delete it and create again.",
      });
    }

    const expenses = await Expense.find({ userId, date: { $gte: goal.startDate } });
    const now = new Date();
    const result = applyReplan(goal, expenses, now);

    const current = result.weeklyPlan.find((w) => new Date(w.weekEnd) >= now);
    const aiNote = await explainPlan({
      kind: "replan",
      title: goal.title,
      targetAmount: goal.targetAmount,
      weeksDone: result.weeksDone,
      savedSoFar: result.savedSoFar,
      remainingAmount: result.remainingAmount,
      remainingWeeks: result.remainingWeeks,
      neededPerWeek: result.neededPerWeek,
      feasible: result.feasible,
      achievableTotal: result.achievableTotal,
      status: result.status,
      categories: current ? categoryView(goal.baseline, current.categoryTargets) : [],
    });

    goal.aiNote = aiNote || goal.aiNote;
    await goal.save();

    return res.json({
      goal,
      report: {
        weeksDone: result.weeksDone,
        savedSoFar: result.savedSoFar,
        remainingAmount: result.remainingAmount,
        remainingWeeks: result.remainingWeeks,
        neededPerWeek: result.neededPerWeek,
        feasible: result.feasible,
        achievableTotal: result.achievableTotal,
        status: result.status,
      },
      aiNote: aiNote || null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

// DELETE /api/v1/goal/:id
exports.deleteGoal = async (req, res) => {
  const userId = req.user.id;
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId });
    if (!goal) {
      return res.status(404).json({ message: "Goal not found or not authorized" });
    }
    res.json({ message: "Goal deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};