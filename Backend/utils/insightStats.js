const { findRootCauses } = require("./rootCause.js");
const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const sum = (arr) => arr.reduce((s, x) => s + x.amount, 0);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
const inRange = (e, from, to) => {
  const t = new Date(e.date).getTime();
  return t >= from && t < to;
};

/**
 * Pichle records se stats nikaalta hai (koi AI nahi, pure math).
 * expenses / incomes: pichle ~90 din ke. budgets: user ke saare (monthly maane gaye).
 */
function buildInsightStats({ expenses, incomes, budgets, now = new Date() }) {
  const t = now.getTime();
  const last30 = expenses.filter((e) => inRange(e, t - 30 * DAY, t + DAY));
  const prev30 = expenses.filter((e) => inRange(e, t - 60 * DAY, t - 30 * DAY));
  const income30 = incomes.filter((e) => inRange(e, t - 30 * DAY, t + DAY));

  const expense30Total = Math.round(sum(last30));
  const expensePrev30Total = Math.round(sum(prev30));
  const income30Total = Math.round(sum(income30));

  // ---- category-wise: last 30 vs pehle ke 30 din ----
  const byCat = (list) =>
    list.reduce((m, e) => ((m[e.category] = (m[e.category] || 0) + e.amount), m), {});
  const cur = byCat(last30);
  const prev = byCat(prev30);
  const categories = Object.keys(cur)
    .map((category) => ({
      category,
      last30: Math.round(cur[category]),
      prev30: Math.round(prev[category] || 0),
      sharePercent: pct(cur[category], expense30Total),
      changePercent: prev[category] > 0 ? Math.round(((cur[category] - prev[category]) / prev[category]) * 100) : null,
    }))
    .sort((a, b) => b.last30 - a.last30)
    .slice(0, 6);

  // ---- budgets: is calendar month ka kharch vs limit ----
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = expenses.filter((e) => new Date(e.date).getTime() >= monthStart);
  const monthByCat = {};
  thisMonth.forEach((e) => {
    const k = e.category.toLowerCase();
    monthByCat[k] = (monthByCat[k] || 0) + e.amount;
  });
  const budgetStatus = budgets
    .map((b) => {
      const spent = Math.round(monthByCat[b.category.toLowerCase()] || 0);
      const usedPercent = pct(spent, b.amount);
      return {
        category: b.category,
        limit: Math.round(b.amount),
        spentThisMonth: spent,
        usedPercent,
        status: usedPercent >= 100 ? "over" : usedPercent >= 80 ? "near" : "ok",
      };
    })
    .filter((b) => b.status !== "ok");

  // ---- kaunse din sabse zyada kharch (90 din) ----
  const byDay = Array(7).fill(0);
  expenses.forEach((e) => (byDay[new Date(e.date).getDay()] += e.amount));
  const total90 = byDay.reduce((s, x) => s + x, 0);
  const topDayIdx = byDay.indexOf(Math.max(...byDay));
  const topWeekday =
    expenses.length >= 10 && total90 > 0
      ? { day: WEEKDAYS[topDayIdx], sharePercent: pct(byDay[topDayIdx], total90) }
      : null;

  // ---- chhote-chhote frequent kharche jo jodne pe bade ho jaate hain ----
  const counts = {};
  last30.forEach((e) => {
    counts[e.category] = counts[e.category] || { count: 0, total: 0 };
    counts[e.category].count++;
    counts[e.category].total += e.amount;
  });
  const frequentSmall = Object.entries(counts)
    .filter(([, v]) => v.count >= 8)
    .map(([category, v]) => ({
      category,
      count: v.count,
      avgAmount: Math.round(v.total / v.count),
      total: Math.round(v.total),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 2);

  return {
    enoughData: expenses.length >= 5,
    expenseCount: expenses.length,
    expense30Total,
    expensePrev30Total,
    expenseChangePercent:
      expensePrev30Total > 0
        ? Math.round(((expense30Total - expensePrev30Total) / expensePrev30Total) * 100)
        : null,
    income30Total,
    savingsRatePercent:
      income30Total > 0 ? Math.round(((income30Total - expense30Total) / income30Total) * 100) : null,
    categories,
    budgetsNeedingAttention: budgetStatus,
    topWeekday,
    frequentSmall,
    rootCauses: findRootCauses({ expenses, now }),
  };
}

/** AI band ho ya fail ho jaye toh bhi kaam chalne wale rule-based suggestions */
function ruleBasedSuggestions(s) {
  const out = [];

  s.budgetsNeedingAttention.slice(0, 2).forEach((b) => {
    out.push(
      b.status === "over"
        ? { type: "warning", title: `${b.category} budget exceeded`, tip: `You have spent ₹${b.spentThisMonth} on ${b.category} this month against a budget of ₹${b.limit}. Hold back on this category for the rest of the month.` }
        : { type: "warning", title: `${b.category} budget almost used`, tip: `${b.usedPercent}% of your ${b.category} budget is already used. Spend carefully.` }
    );
  });

  // ---- category kyun badhi (root cause) ----
  const cause = (s.rootCauses || [])[0];
  if (cause) {
    const why = {
      one_big_purchase: `One large purchase of ₹${cause.largestPurchase} drove this.`,
      more_frequent: `You spent more often (${cause.countPrev30} times before, ${cause.countLast30} times now).`,
      bigger_purchases: `Each purchase was bigger (average went from ₹${cause.avgPrev30} to ₹${cause.avgLast30}).`,
      new_category: `There was no spending in this category before.`,
      mixed: ``,
    }[cause.driver];
    const shift = cause.offsettingCategories.find((o) => o.weeklyRelation !== "weak");
    const shiftText = shift
      ? ` ${shift.category} dropped by ₹${shift.dropAmount}, so spending may have shifted from there.`
      : "";
    out.push({
      type: "warning",
      title: `${cause.category} spending went up`,
      tip: `In the last 30 days it went from ₹${cause.prev30} to ₹${cause.last30}. ${why}${shiftText}`.replace(/\s+/g, " ").trim(),
    });
  }

  if (s.frequentSmall[0]) {
    const f = s.frequentSmall[0];
    out.push({ type: "tip", title: "Small expenses are adding up", tip: `You spent on ${f.category} ${f.count} times, averaging ₹${f.avgAmount} for a total of ₹${f.total}. You could cut some of these.` });
  }

  if (s.topWeekday && s.topWeekday.sharePercent >= 25) {
    out.push({ type: "tip", title: `Higher spending on ${s.topWeekday.day}`, tip: `${s.topWeekday.sharePercent}% of your spending happens on ${s.topWeekday.day}. Try setting a limit for that day.` });
  }

  if (s.savingsRatePercent !== null) {
    out.push(
      s.savingsRatePercent < 10
        ? { type: "warning", title: "Savings are low", tip: `You saved only ${Math.max(s.savingsRatePercent, 0)}% in the last 30 days. Aim for at least 20%.` }
        : s.savingsRatePercent >= 30
        ? { type: "good", title: "Savings look great", tip: `You saved ${s.savingsRatePercent}% of your income in the last 30 days. Keep it up.` }
        : null
    );
  }

  return out.filter(Boolean).slice(0, 4);
}

module.exports = { buildInsightStats, ruleBasedSuggestions };