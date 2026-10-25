import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { getSuggestions } from '../utils/api';
import { FaMagic, FaTimes, FaSyncAlt, FaExclamationTriangle, FaLightbulb, FaCheckCircle } from 'react-icons/fa';


// type -> icon + rang
const STYLES = {
  warning: { icon: FaExclamationTriangle, box: 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  tip: { icon: FaLightbulb, box: 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  good: { icon: FaCheckCircle, box: 'border-green-300 bg-green-50 dark:border-green-500/40 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400' },
};

const AiAssistant = () => {
  const { token } = useFinance();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null); // { suggestions, source, message }

  // login/signup pe ya logout hone pe icon nahi dikhana
  if (!token || pathname === '/login' || pathname === '/signup') return null;

  const load = async (refresh = false) => {
    try {
      setLoading(true);
      setError('');
      const res = await getSuggestions(refresh);
      setData(res.data);
    } catch (err) {
      setError(err.message || 'Could not load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !data && !loading) load(); // pehli baar kholne pe hi fetch
  };

  return (
    <>
      {/* Side icon */}
      {!open && (
        <button
          onClick={toggle}
          aria-label="Open AI suggestions"
          title="AI Suggestions"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-11 h-14 rounded-l-2xl bg-gradient-to-b from-violet-500 to-blue-600 text-white shadow-lg hover:w-14 transition-all duration-200"
        >
          <FaMagic className="text-lg" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 text-white flex items-center justify-center">
                <FaMagic className="text-sm" />
              </span>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white leading-tight">AI Suggestions</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Based on your recent records</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => load(true)}
                disabled={loading}
                aria-label="Refresh suggestions"
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <FaSyncAlt className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {loading && !data && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/40 p-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {data && data.suggestions.length === 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center py-10">
                {data.message || 'No suggestions right now.'}
              </p>
            )}

            {data &&
              data.suggestions.map((s, i) => {
                const st = STYLES[s.type] || STYLES.tip;
                const Icon = st.icon;
                return (
                  <div key={i} className={`rounded-xl border p-4 ${st.box}`}>
                    <div className={`flex items-center gap-2 font-semibold ${st.text}`}>
                      <Icon />
                      <span>{s.title}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-gray-700 dark:text-gray-200">{s.tip}</p>
                  </div>
                );
              })}
          </div>

          {data && data.source !== 'none' && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
              {data.source === 'ai' ? 'Generated by AI from your records' : 'Basic analysis (AI is not available right now)'}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AiAssistant;