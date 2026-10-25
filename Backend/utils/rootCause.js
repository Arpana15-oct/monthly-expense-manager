const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const sum = (list) => list.reduce((s, e) => s + e.amount, 0);

const pearson = (a, b) => {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
};

/**
 * "Kaunsi category kyun badhi?" - pure math, AI nahi.
 * Har badhi hui category ko 4 wajah mein se ek mein todta hai:
 *   one_big_purchase | more_frequent | bigger_purchases | new_category | mixed
 * Aur dhoondta hai ki kya koi doosri category usi time ghati (shayad kharch wahan shift hua).
 * expenses: pichle ~90 din ke.
 */
function findRootCauses({ expenses, now = new Date(), minExtra = 300, minPercent = 30 }) {
  const t = now.getTime();
  const within = (from, to) =>
    expenses.filter((e) => {
      const x = new Date(e.date).getTime();
      return x >= from && x < to;
    });
  const last30 = within(t - 30 * DAY, t + DAY);
  const prev30 = within(t - 60 * DAY, t - 30 * DAY);

  const group = (list) => {
    const m = {};
    list.forEach((e) => {
      if (!m[e.category]) m[e.category] = [];
      m[e.category].push(e);
    });
    return m;
  };
  const cur = group(last30);
  const prev = group(prev30);

  // 12 hafte ki weekly series (correlation ke liye)
  const weekly = (cat) => {
    const arr = Array(12).fill(0);
    expenses.forEach((e) => {
      if (e.category !== cat) return;
      const age = t - new Date(e.date).getTime();
      const w = Math.floor(age / WEEK);
      if (w >= 0 && w < 12) arr[w] += e.amount;
    });
    return arr;
  };

  const allCats = new Set([...Object.keys(cur), ...Object.keys(prev)]);
  const change = {};
  allCats.forEach((c) => {
    const a = sum(cur[c] || []);
    const b = sum(prev[c] || []);
    change[c] = { cur: a, prev: b, delta: a - b };
  });

  const causes = [];
  Object.keys(cur).forEach((cat) => {
    const { cur: c, prev: p, delta } = change[cat];
    const pctUp = p > 0 ? ((c - p) / p) * 100 : 100;
    if (delta < minExtra || pctUp < minPercent) return;

    const curList = cur[cat];
    const prevList = prev[cat] || [];
    const countCur = curList.length;
    const countPrev = prevList.length;
    const avgCur = c / countCur;
    const avgPrev = countPrev > 0 ? p / countPrev : 0;
    const largest = Math.max(...curList.map((e) => e.amount));

    // ---- wajah ----
    let driver = "mixed";
    if (countPrev === 0) driver = "new_category";
    else if (largest >= 2 * avgPrev && largest - avgPrev >= 0.5 * delta) driver = "one_big_purchase";
    else if (countCur >= countPrev * 1.3 && avgCur < avgPrev * 1.2) driver = "more_frequent";
    else if (avgCur >= avgPrev * 1.3 && countCur < countPrev * 1.3) driver = "bigger_purchases";

    // ---- kya koi doosri category ghati? ----
    const wX = weekly(cat);
    const offsetting = Object.keys(change)
      .filter((y) => y !== cat)
      .map((y) => ({ y, drop: -change[y].delta, pct: change[y].prev > 0 ? (-change[y].delta / change[y].prev) * 100 : 0 }))
      .filter((x) => x.drop >= minExtra && x.pct >= minPercent)
      .sort((a, b) => b.drop - a.drop)
      .slice(0, 2)
      .map((x) => {
        const r = pearson(wX, weekly(x.y));
        return {
          category: x.y,
          dropAmount: Math.round(x.drop),
          changePercent: -Math.round(x.pct),
          weeklyRelation: r <= -0.6 ? "strong" : r <= -0.4 ? "moderate" : "weak",
        };
      });

    causes.push({
      category: cat,
      last30: Math.round(c),
      prev30: Math.round(p),
      extra: Math.round(delta),
      changePercent: p > 0 ? Math.round(pctUp) : null,
      driver,
      countLast30: countCur,
      countPrev30: countPrev,
      avgLast30: Math.round(avgCur),
      avgPrev30: Math.round(avgPrev),
      largestPurchase: Math.round(largest),
      offsettingCategories: offsetting,
    });
  });

  return causes.sort((a, b) => b.extra - a.extra).slice(0, 3);
}

module.exports = { findRootCauses };