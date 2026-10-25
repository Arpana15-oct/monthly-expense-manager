import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useFinance } from '../../context/FinanceContext';
import { getAllGoals, addGoal, replanGoal, deleteGoal } from '../../utils/api';
import {
  FaArrowLeft, FaMoon, FaSun, FaPlus, FaTrash, FaSyncAlt, FaMagic,
  FaBullseye, FaExclamationTriangle, FaCheckCircle,
} from 'react-icons/fa';

const CUR = '₹'; // change the currency symbol here

const fmt = (n) => `${CUR}${Math.round(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const currentWeek = (goal) => {
  const now = Date.now();
  return (
    goal.weeklyPlan.find((w) => new Date(w.weekStart) <= now && now <= new Date(w.weekEnd)) ||
    goal.weeklyPlan.find((w) => new Date(w.weekStart) > now) ||
    null
  );
};

const STATUS = {
  active: { label: 'Active', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  failed: { label: 'Missed', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const Bar = ({ percent, over }) => (
  <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
    <div
      className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-green-500'}`}
      style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
    />
  </div>
);

const GoalCard = ({ goal, busy, onReplan, onDelete }) => {
  const week = currentWeek(goal);
  const saved = Math.max(goal.savedSoFar || 0, 0);
  const progress = goal.targetAmount > 0 ? (saved / goal.targetAmount) * 100 : 0;
  const st = STATUS[goal.status] || STATUS.active;
  const report = goal.lastReport || {};
  const weekOver = week && week.actualSpend > week.targetSpend;
  const weekPercent = week && week.targetSpend > 0 ? (week.actualSpend / week.targetSpend) * 100 : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{goal.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {fmtDate(goal.startDate)} → {fmtDate(goal.endDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
          <button
            onClick={() => onDelete(goal)}
            disabled={busy}
            aria-label="Delete goal"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            <FaTrash />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600 dark:text-gray-300">Saved</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {fmt(goal.savedSoFar)} <span className="text-gray-400 font-normal">of {fmt(goal.targetAmount)}</span>
          </span>
        </div>
        <Bar percent={progress} />
      </div>

      {/* Not feasible warning */}
      {!goal.feasible && goal.status === 'active' && (
        <div className="mt-4 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10 p-4 text-sm">
          <FaExclamationTriangle className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-amber-800 dark:text-amber-200">
            This goal is not reachable at the current pace. You can save about <b>{fmt(goal.achievableTotal)}</b> at most.
            Extend the deadline or lower the target.
          </p>
        </div>
      )}
      {goal.status === 'completed' && (
        <div className="mt-4 flex gap-3 rounded-xl border border-green-300 bg-green-50 dark:border-green-500/40 dark:bg-green-500/10 p-4 text-sm">
          <FaCheckCircle className="text-green-500 mt-0.5 shrink-0" />
          <p className="text-green-800 dark:text-green-200">Goal completed. Great job! 🎉</p>
        </div>
      )}

      {/* Numbers */}
      {goal.status === 'active' && (
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Weeks left</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{report.remainingWeeks ?? '-'}</p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Save / week</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {report.neededPerWeek != null ? fmt(report.neededPerWeek) : '-'}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {report.remainingAmount != null ? fmt(report.remainingAmount) : '-'}
            </p>
          </div>
        </div>
      )}

      {/* This week */}
      {goal.status === 'active' && week && (
        <div className="mt-5 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-gray-900 dark:text-white">
              This week ({fmtDate(week.weekStart)} - {fmtDate(week.weekEnd)})
            </span>
            <span className={weekOver ? 'text-red-600 font-semibold' : 'text-gray-600 dark:text-gray-300'}>
              {fmt(week.actualSpend)} / {fmt(week.targetSpend)}
            </span>
          </div>
          <Bar percent={weekPercent} over={weekOver} />
          {weekOver && (
            <p className="mt-2 text-xs text-red-600">You have crossed this week's limit. The plan will adjust the next time you update it.</p>
          )}
          {week.categoryTargets?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {week.categoryTargets.map((c) => (
                <span
                  key={c.category}
                  className="px-3 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                >
                  {c.category}: max {fmt(c.limit)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI note */}
      {goal.aiNote && (
        <div className="mt-5 flex gap-3 rounded-xl bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 border border-violet-200 dark:border-violet-500/30 p-4">
          <FaMagic className="text-violet-500 mt-1 shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-200">{goal.aiNote}</p>
        </div>
      )}

      {/* Weekly table */}
      <details className="mt-5 group">
        <summary className="cursor-pointer text-sm font-medium text-blue-600 dark:text-blue-400">
          View all weeks
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-1 pr-4 font-medium">Week</th>
                <th className="py-1 pr-4 font-medium">Limit</th>
                <th className="py-1 font-medium">Actual</th>
              </tr>
            </thead>
            <tbody>
              {goal.weeklyPlan.map((w, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200">
                  <td className="py-1.5 pr-4">{fmtDate(w.weekStart)}</td>
                  <td className="py-1.5 pr-4">{fmt(w.targetSpend)}</td>
                  <td className={`py-1.5 ${w.actualSpend > w.targetSpend ? 'text-red-600 font-semibold' : ''}`}>
                    {new Date(w.weekStart) > Date.now() ? '-' : fmt(w.actualSpend)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Actions */}
      {goal.status === 'active' && (
        <button
          onClick={() => onReplan(goal)}
          disabled={busy}
          className="mt-5 w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg disabled:opacity-60"
        >
          <FaSyncAlt className={`mr-2 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Updating...' : 'Update plan'}
        </button>
      )}
    </div>
  );
};

const Goals = () => {
  const { theme, toggleTheme } = useFinance();
  const [goals, setGoals] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ title: '', targetAmount: '', endDate: '', fixed: '' });

  const load = async () => {
    try {
      const res = await getAllGoals();
      setGoals(res.data);
    } catch (err) {
      toast.error(err.message || 'Could not load goals');
      setGoals([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Paisa Buddy creates goals from chat; refresh the list when it does
  useEffect(() => {
    const h = () => load();
    window.addEventListener('buddy:changed', h);
    return () => window.removeEventListener('buddy:changed', h);
  }, []);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const fixedCategories = form.fixed.split(',').map((x) => x.trim()).filter(Boolean);
      const res = await addGoal({
        title: form.title.trim(),
        targetAmount: Number(form.targetAmount),
        endDate: form.endDate,
        fixedCategories,
      });
      if (res.data.summary?.feasible === false) {
        toast('Goal created, but it is hard to reach at this pace.', { icon: '⚠️' });
      } else {
        toast.success('Goal created!');
      }
      setForm({ title: '', targetAmount: '', endDate: '', fixed: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not create the goal');
    } finally {
      setSubmitting(false);
    }
  };

  const onReplan = async (goal) => {
    try {
      setBusyId(goal._id);
      const res = await replanGoal(goal._id);
      toast.success(res.data.aiNote ? 'Plan updated' : 'Plan updated (AI note was not refreshed)');
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not update the plan');
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (goal) => {
    if (!window.confirm(`Delete "${goal.title}"?`)) return;
    try {
      setBusyId(goal._id);
      await deleteGoal(goal._id);
      toast.success('Goal deleted');
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not delete the goal');
    } finally {
      setBusyId(null);
    }
  };

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link
                to="/dashboard"
                className="mr-4 p-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
              >
                <FaArrowLeft className="text-lg" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Savings Goals</h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">A plan that adjusts itself to your spending</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className="p-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              >
                {theme === 'light' ? <FaMoon /> : <FaSun className="text-yellow-500" />}
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg"
              >
                <FaPlus className="mr-2" />
                New Goal
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Form */}
        {showForm && (
          <form
            onSubmit={onSubmit}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goal name</label>
              <input name="title" value={form.title} onChange={onChange} required placeholder="Goa Trip" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount to save ({CUR})</label>
              <input name="targetAmount" type="number" min="1" value={form.targetAmount} onChange={onChange} required placeholder="15000" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deadline</label>
              <input name="endDate" type="date" value={form.endDate} onChange={onChange} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fixed categories (optional, comma separated)
              </label>
              <input name="fixed" value={form.fixed} onChange={onChange} placeholder="Rent, Hostel mess" className={inputCls} />
            </div>
            <div className="md:col-span-2 flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                The plan is built from your last 12 weeks of spending, so add some expenses first.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg disabled:opacity-60"
              >
                {submitting ? 'Creating plan...' : 'Create plan'}
              </button>
            </div>
          </form>
        )}

        {/* List */}
        {goals === null ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
              <FaBullseye className="text-blue-600 text-2xl" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">No goals yet</h3>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Click "New Goal" to create your first savings goal.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {goals.map((g) => (
              <GoalCard key={g._id} goal={g} busy={busyId === g._id} onReplan={onReplan} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Goals;