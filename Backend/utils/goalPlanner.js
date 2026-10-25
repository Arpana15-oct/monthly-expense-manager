const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const DEFAULT_FIXED = [
  "rent", "bill", "emi", "loan", "insurance",
  "fees", "electricity", "recharge", "subscription",
];

const isFixed = (category, extraFixed = []) => {
  const c = category.toLowerCase().trim();
  // user / AI ne jo naam diye unka exact match, default list ka keyword match
  if (extraFixed.some((x) => x.toLowerCase().trim() === c)) return true;
  return DEFAULT_FIXED.some((k) => c.includes(k));
};

/**
 * Core: har hafte kitna bachana hai (needPerWeek) -> categories mein cut kaise baante.
 * buildPlan aur replan dono yahi use karte hain.
 */
function allocate({ baseline, needPerWeek, maxCutPercent }) {
  const baselineTotal = baseline.reduce((s, c) => s + c.weeklyAvg, 0);
  const totalCapacity = baselineTotal * maxCutPercent;
  const feasible = needPerWeek <= totalCapacity;
  const cut = Math.max(0, Math.min(needPerWeek, totalCapacity));

  const categoryTargets = baseline.map((c) => {
    const share = totalCapacity > 0 ? (c.weeklyAvg * maxCutPercent) / totalCapacity : 0;
    return { category: c.category, limit: Math.round(c.weeklyAvg - cut * share) };
  });

  return {
    feasible,
    cut,
    baselineTotal,
    categoryTargets,
    targetSpend: Math.round(baselineTotal - cut),
  };
}

/** Goal banate waqt ka pehla plan */
function buildPlan({
  expenses,
  targetAmount,
  startDate,
  endDate,
  fixedCategories = [],
  maxCutPercent = 0.4,
  now = new Date(),
}) {
  const earliest = expenses.reduce(
    (min, e) => Math.min(min, new Date(e.date).getTime()),
    now.getTime()
  );
  const historyWeeks = Math.min(12, Math.max(1, Math.ceil((now - earliest) / WEEK)));

  // sirf flexible categories ka weekly average
  const totals = {};
  for (const e of expenses) {
    if (isFixed(e.category, fixedCategories)) continue;
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  }
  const baseline = Object.keys(totals).map((category) => ({
    category,
    weeklyAvg: Math.round(totals[category] / historyWeeks),
  }));

  const weeksCount = Math.max(
    1,
    Math.ceil((new Date(endDate) - new Date(startDate)) / WEEK)
  );
  const weeklySaving = targetAmount / weeksCount;
  const a = allocate({ baseline, needPerWeek: weeklySaving, maxCutPercent });

  const weeklyPlan = [];
  for (let i = 0; i < weeksCount; i++) {
    const weekStart = new Date(new Date(startDate).getTime() + i * WEEK);
    const weekEnd = new Date(
      Math.min(weekStart.getTime() + WEEK - 1, new Date(endDate).getTime())
    );
    weeklyPlan.push({
      weekStart,
      weekEnd,
      targetSpend: a.targetSpend,
      actualSpend: 0,
      categoryTargets: a.categoryTargets,
    });
  }

  return {
    feasible: a.feasible,
    weeksCount,
    weeklySaving: Math.round(weeklySaving),
    achievableTotal: Math.round(a.cut * weeksCount),
    weeklyBaseline: Math.round(a.baselineTotal),
    baseline,
    weeklyPlan,
  };
}

/**
 * Re-plan: jo hafte khatam ho gaye unka actual dekho, kitna bacha wo nikalo,
 * aur baaki hafton ke targets naye sire se calculate karo.
 *
 * goal: plain object { targetAmount, baseline, fixedCategories, weeklyPlan }
 * expenses: goal.startDate ke baad ke saare expenses
 */
function replan({ goal, expenses, now = new Date(), maxCutPercent = 0.4 }) {
  const baseline = goal.baseline || [];
  const baselineTotal = baseline.reduce((s, c) => s + c.weeklyAvg, 0);
  const fixed = goal.fixedCategories || [];
  const flexExpenses = expenses.filter((e) => !isFixed(e.category, fixed));

  // 1. Har hafte ka actual kharch + ab tak kitna bacha
  let savedSoFar = 0;
  let weeksDone = 0;
  const weeks = goal.weeklyPlan.map((w) => {
    const ws = new Date(w.weekStart).getTime();
    const we = new Date(w.weekEnd).getTime();
    const spent = flexExpenses
      .filter((e) => {
        const t = new Date(e.date).getTime();
        return t >= ws && t <= we;
      })
      .reduce((s, e) => s + e.amount, 0);

    const week = { ...w, actualSpend: Math.round(spent) };
    if (we < now.getTime()) {
      savedSoFar += baselineTotal - spent; // negative bhi ho sakta hai (overspend)
      weeksDone++;
    }
    return week;
  });
  savedSoFar = Math.round(savedSoFar);

  // 2. Baaki kya hai
  const remainingAmount = goal.targetAmount - savedSoFar;
  const remainingIdx = weeks
    .map((w, i) => (new Date(w.weekEnd).getTime() >= now.getTime() ? i : -1))
    .filter((i) => i >= 0);
  const remainingWeeks = remainingIdx.length;

  const report = { weeksDone, savedSoFar, remainingAmount, remainingWeeks };

  // 3a. Goal already pura
  if (remainingAmount <= 0) {
    const a = allocate({ baseline, needPerWeek: 0, maxCutPercent });
    remainingIdx.forEach((i) => {
      weeks[i].targetSpend = a.targetSpend;
      weeks[i].categoryTargets = a.categoryTargets;
    });
    return {
      ...report, status: "completed", feasible: true,
      neededPerWeek: 0, achievableTotal: savedSoFar, weeklyPlan: weeks,
    };
  }

  // 3b. Time khatam, goal adhura
  if (remainingWeeks === 0) {
    return {
      ...report, status: "failed", feasible: false,
      neededPerWeek: 0, achievableTotal: savedSoFar, weeklyPlan: weeks,
    };
  }

  // 3c. Baaki hafton ke liye naya plan
  const neededPerWeek = remainingAmount / remainingWeeks;
  const a = allocate({ baseline, needPerWeek: neededPerWeek, maxCutPercent });
  remainingIdx.forEach((i) => {
    weeks[i].targetSpend = a.targetSpend;
    weeks[i].categoryTargets = a.categoryTargets;
  });

  return {
    ...report,
    status: "active",
    feasible: a.feasible,
    neededPerWeek: Math.round(neededPerWeek),
    achievableTotal: Math.round(savedSoFar + a.cut * remainingWeeks),
    weeklyPlan: weeks,
  };
}

module.exports = { buildPlan, replan, isFixed };