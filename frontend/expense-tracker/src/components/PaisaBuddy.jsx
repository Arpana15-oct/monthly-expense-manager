import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useFinance } from '../context/FinanceContext';
import { sendBuddyMessage, scanReceipt, deleteExpense } from '../utils/api';
import {
  FaCommentDots, FaTimes, FaPaperPlane, FaMicrophone, FaStop, FaCheckCircle, FaTrashAlt, FaCamera, FaUndo,
} from 'react-icons/fa';

const SUGGESTIONS = [
  'I spent ₹250 on lunch today',
  'Set my Food budget to ₹5000',
  'I want to save ₹50,000 for a bike in 6 months',
  'How much did I spend last week?',
];

// Browser ka built-in speech-to-text (Chrome/Edge/Safari). Firefox mein nahi hota, tab mic button hide ho jaata hai.
const SpeechRec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const PaisaBuddy = () => {
  const { token, fetchExpenses, fetchIncomes, fetchBudgets, fetchDashboardData } = useFinance();
  const { pathname } = useLocation();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user' | 'assistant', text, actions?, error? }
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState('en-IN'); // mic ki language: 'en-IN' ya 'hi-IN'

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const recRef = useRef(null);
  const fileRef = useRef(null);

  // naya message aate hi neeche scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending, open]);

  // panel khulte hi input pe focus, Esc se band
  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // panel band ya component hatne pe mic band
  useEffect(() => {
    if (!open) stopListening();
    return () => stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // login/signup pe ya logout hone pe button nahi dikhana
  if (!token || pathname === '/login' || pathname === '/signup') return null;

  function stopListening() {
    try { recRef.current?.stop(); } catch (e) { /* already stopped */ }
    recRef.current = null;
    setListening(false);
  }

  const toggleMic = () => {
    if (listening) { stopListening(); return; }
    const rec = new SpeechRec();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput(text); // seedha send nahi karte, taaki galat suni hui amount pehle dikh jaye
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error('Microphone permission is blocked. Allow it in the browser address bar.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast.error('Could not hear that. Try again.');
      }
    };
    rec.onend = () => { setListening(false); inputRef.current?.focus(); };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setListening(false);
    }
  };

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    if (listening) stopListening();

    const next = [...messages, { role: 'user', text: msg }];
    setMessages(next);
    setInput('');
    setSending(true);

    try {
      // sirf text history bhejte hain (error bubbles aur action chips nahi)
      const history = next.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
      const res = await sendBuddyMessage(history);
      const { reply, actions = [], changed = {} } = res.data;
      setMessages((m) => [...m, { role: 'assistant', text: reply, actions }]);

      // jo badla uski screens refresh karo
      const jobs = [];
      if (changed.expenses) jobs.push(fetchExpenses());
      if (changed.incomes) jobs.push(fetchIncomes());
      if (changed.budgets) jobs.push(fetchBudgets());
      if (changed.expenses || changed.incomes) jobs.push(fetchDashboardData());
      if (Object.keys(changed).length) window.dispatchEvent(new Event('buddy:changed')); // Goals page sunta hai
      await Promise.all(jobs);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: err.message || 'Something went wrong. Try again.', error: true }]);
    } finally {
      setSending(false);
    }
  };

  const handleReceiptFile = async (file) => {
    if (!file || sending) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image is too large (max 8MB).');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setMessages((m) => [...m, { role: 'user', kind: 'receipt', image: previewUrl }]);
    setSending(true);
    try {
      const res = await scanReceipt(file);
      const { added, expense, merchant, message } = res.data;
      if (added) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: merchant ? `Added from ${merchant}.` : 'Added from your receipt.',
            actions: [{ kind: 'expense', text: `Expense added · ₹${expense.amount} · ${expense.category}` }],
            undo: { id: expense._id },
          },
        ]);
        await Promise.all([fetchExpenses(), fetchDashboardData()]);
        window.dispatchEvent(new Event('buddy:changed'));
      } else {
        setMessages((m) => [...m, { role: 'assistant', text: message || "Couldn't read that receipt. Try again or enter it manually." }]);
      }
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: err.message || 'Could not scan the receipt.', error: true }]);
    } finally {
      setSending(false);
    }
  };

  const undoExpense = async (index, id) => {
    try {
      await deleteExpense(id);
      setMessages((m) => m.map((mm, i) => (i === index ? { ...mm, undo: null, text: `${mm.text} Removed.` } : mm)));
      await Promise.all([fetchExpenses(), fetchDashboardData()]);
      window.dispatchEvent(new Event('buddy:changed'));
    } catch (err) {
      toast.error(err.message || 'Could not remove that expense.');
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Paisa Buddy chat"
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 h-14 px-4 sm:px-5 rounded-full bg-gradient-to-r from-violet-500 to-blue-600 text-white shadow-xl shadow-violet-500/30 hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 transition-transform duration-200"
        >
          <FaCommentDots className="text-xl" />
          <span className="hidden sm:inline font-semibold text-sm">Paisa Buddy</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Paisa Buddy chat"
          className="fixed bottom-4 right-4 z-[60] w-[calc(100vw-2rem)] sm:w-96 h-[min(34rem,calc(100vh-2rem))] flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500 to-blue-600 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 shrink-0 rounded-full bg-white/20 flex items-center justify-center">
                <FaCommentDots />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold leading-tight">Paisa Buddy</h2>
                <p className="text-xs text-white/80 truncate">Add, set or check anything by chatting</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  aria-label="Clear chat"
                  title="Clear chat"
                  className="p-2 rounded-lg text-white/80 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <FaTrashAlt className="text-sm" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="p-2 rounded-lg text-white/80 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div role="log" aria-live="polite" className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="pt-2">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  Hi! I can add expenses and income, set budgets, create savings goals and check your numbers. Type or use the mic.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === 'user' ? (
                m.kind === 'receipt' ? (
                  <div key={i} className="ml-auto max-w-[70%]">
                    <img src={m.image} alt="Receipt" className="rounded-2xl rounded-br-md border border-violet-300 dark:border-violet-500/40 max-h-48 w-auto object-cover" />
                  </div>
                ) : (
                  <div
                    key={i}
                    className="ml-auto max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-gradient-to-br from-violet-500 to-blue-600 text-white text-sm whitespace-pre-wrap break-words"
                  >
                    {m.text}
                  </div>
                )
              ) : (
                <div key={i} className="mr-auto max-w-[90%] space-y-1.5">
                  {m.actions?.map((a, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-1.5 w-fit max-w-full px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30"
                    >
                      <FaCheckCircle className="shrink-0" />
                      <span className="truncate">{a.text}</span>
                      {m.undo && (
                        <button
                          onClick={() => undoExpense(i, m.undo.id)}
                          className="ml-1 flex items-center gap-1 text-green-800 dark:text-green-300 underline underline-offset-2 hover:text-green-900 dark:hover:text-green-200"
                        >
                          <FaUndo className="text-[10px]" /> Undo
                        </button>
                      )}
                    </div>
                  ))}
                  <div
                    className={`px-3.5 py-2 rounded-2xl rounded-bl-md text-sm whitespace-pre-wrap break-words ${
                      m.error
                        ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              )
            )}

            {sending && (
              <div className="mr-auto flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-700" aria-label="Buddy is typing">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-300 animate-bounce"
                    style={{ animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 dark:border-gray-700 p-3">
            <div className="flex items-center gap-2">
              {SpeechRec && (
                <>
                  <button
                    onClick={() => setLang((l) => (l === 'en-IN' ? 'hi-IN' : 'en-IN'))}
                    disabled={listening}
                    aria-label={`Mic language: ${lang === 'en-IN' ? 'English' : 'Hindi'}. Click to switch.`}
                    title="Mic language"
                    className="shrink-0 h-10 px-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  >
                    {lang === 'en-IN' ? 'EN' : 'हि'}
                  </button>
                  <button
                    onClick={toggleMic}
                    aria-label={listening ? 'Stop listening' : 'Speak'}
                    title={listening ? 'Stop' : 'Speak'}
                    className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                      listening ? 'bg-red-500 animate-pulse' : 'bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-500'
                    }`}
                  >
                    {listening ? <FaStop /> : <FaMicrophone />}
                  </button>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) handleReceiptFile(f);
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={sending}
                aria-label="Scan a receipt"
                title="Scan a receipt"
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-500 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <FaCamera />
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                maxLength={500}
                placeholder={listening ? 'Listening...' : 'e.g. gave mom 2000 today'}
                aria-label="Message Paisa Buddy"
                className="flex-1 min-w-0 h-10 px-3 rounded-xl text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              />
              <button
                onClick={() => send()}
                disabled={sending || !input.trim()}
                aria-label="Send message"
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-violet-500 to-blue-600 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <FaPaperPlane className="text-sm" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaisaBuddy;
