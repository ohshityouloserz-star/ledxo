import React, { useState, useEffect, useCallback, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { Check, X, Plus, ChevronLeft, ChevronRight, Flame, Trash2, Clock, Maximize2, Minimize2, Snowflake, Heart, Wind, Umbrella, Sun, Zap, Cloud, Feather, Coffee, Moon, Star, Compass, Play, Pause, RotateCcw } from "lucide-react";

if (!window.storage) {
  window.storage = {
    get: async (key) => {
      const val = localStorage.getItem(key);
      return val !== null ? { value: val } : null;
    },
    set: async (key, val) => {
      localStorage.setItem(key, val);
    },
    list: async (prefix) => {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      return { keys };
    },
  };
}

const FONT_IMPORT = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap');
`;

function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function isSameDay(a, b) {
  return toKey(a) === toKey(b);
}
function dayLabel(date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const TIME_OPTIONS = [];
for (let i = 0; i < 24; i++) {
  for (let j = 0; j < 60; j += 30) {
    const hh = String(i).padStart(2, "0");
    const mm = String(j).padStart(2, "0");
    TIME_OPTIONS.push(`${hh}:${mm}`);
  }
}

const MONTH_DOODLES = [
  <Snowflake size={18} strokeWidth={1.5} />,
  <Heart size={18} strokeWidth={1.5} />,
  <Wind size={18} strokeWidth={1.5} />,
  <Umbrella size={18} strokeWidth={1.5} />,
  <Sun size={18} strokeWidth={1.5} />,
  <Zap size={18} strokeWidth={1.5} />,
  <Cloud size={18} strokeWidth={1.5} />,
  <Feather size={18} strokeWidth={1.5} />,
  <Coffee size={18} strokeWidth={1.5} />,
  <Moon size={18} strokeWidth={1.5} />,
  <Star size={18} strokeWidth={1.5} />,
  <Compass size={18} strokeWidth={1.5} />
];

function StudyLedger() {
  const [viewDate, setViewDate] = useState(new Date());
  const [targetsByDay, setTargetsByDay] = useState({});
  const [notes, setNotes] = useState("");
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [crossedDates, setCrossedDates] = useState({});
  const [newTaskText, setNewTaskText] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [now, setNow] = useState(new Date());

  // Custom Pomodoro Timer State
  const [customHours, setCustomHours] = useState(0);
  const [customMins, setCustomMins] = useState(25);
  const [pomoTime, setPomoTime] = useState(25 * 60);
  const [pomoActive, setPomoActive] = useState(false);

  // Calendar View State
  const [calendarView, setCalendarView] = useState(new Date(now.getFullYear(), now.getMonth(), 1));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Pomodoro Countdown Handler
  useEffect(() => {
    let timer = null;
    if (pomoActive && pomoTime > 0) {
      timer = setInterval(() => setPomoTime((prev) => prev - 1), 1000);
    } else if (pomoTime === 0) {
      setPomoActive(false);
    }
    return () => clearInterval(timer);
  }, [pomoActive, pomoTime]);

  const applyCustomTimer = (h, m) => {
    const totalSeconds = (parseInt(h || 0, 10) * 3600) + (parseInt(m || 0, 10) * 60);
    setPomoTime(totalSeconds);
    setPomoActive(false);
  };

  const formatPomoTime = (totalSec) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    
    if (h > 0) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatLiveClock = (date) => {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  const today = useMemo(() => new Date(), [now.toDateString()]);
  const viewKey = toKey(viewDate);
  const isToday = isSameDay(viewDate, today);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const notesRes = await window.storage.get("notes").catch(() => null);
        if (!cancelled && notesRes && typeof notesRes.value === "string") setNotes(notesRes.value);
      } catch (e) {}
      try {
        const crossedRes = await window.storage.get("crossed-dates").catch(() => null);
        if (!cancelled && crossedRes && crossedRes.value) setCrossedDates(JSON.parse(crossedRes.value));
      } catch (e) {}
      try {
        const listRes = await window.storage.list("targets:").catch(() => null);
        if (listRes && listRes.keys && listRes.keys.length) {
          const entries = await Promise.all(
            listRes.keys.map(async (k) => {
              try {
                const r = await window.storage.get(k);
                return [k.replace("targets:", ""), r ? JSON.parse(r.value) : []];
              } catch {
                return [k.replace("targets:", ""), []];
              }
            })
          );
          if (!cancelled) {
            const map = {};
            entries.forEach(([day, val]) => { map[day] = val; });
            setTargetsByDay(map);
          }
        }
      } catch (e) {}
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const saveDay = useCallback(async (key, tasks) => {
    try {
      await window.storage.set(`targets:${key}`, JSON.stringify(tasks));
    } catch (e) {}
  }, []);

  const saveNotes = useCallback(async (text) => {
    try {
      await window.storage.set("notes", text);
    } catch (e) {}
  }, []);

  const handleCrossDate = useCallback((date, key) => {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (date > todayStart) return;
    setCrossedDates((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      window.storage.set("crossed-dates", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [today]);

  const currentTasks = targetsByDay[viewKey] || [];

  function updateDay(key, updater) {
    setTargetsByDay((prev) => {
      const next = { ...prev, [key]: updater(prev[key] || []) };
      saveDay(key, next[key]);
      return next;
    });
  }

  function addTask() {
    const text = newTaskText.trim();
    if (!text) return;
    updateDay(viewKey, (tasks) => [
      ...tasks,
      { id: uid(), text, status: "pending", start: newStart || null, end: newEnd || null },
    ]);
    setNewTaskText("");
    setNewStart("");
    setNewEnd("");
  }

  function setStatus(id, status) {
    updateDay(viewKey, (tasks) =>
      tasks.map((t) => (t.id === id ? { ...t, status: t.status === status ? "pending" : status } : t))
    );
  }

  function removeTask(id) {
    updateDay(viewKey, (tasks) => tasks.filter((t) => t.id !== id));
  }

  const streak = useMemo(() => {
    let count = 0;
    let cursor = new Date(today);
    for (let i = 0; i < 3650; i++) {
      const key = toKey(cursor);
      const tasks = targetsByDay[key];
      if (!tasks || tasks.length === 0) {
        if (isSameDay(cursor, today)) {
          cursor = addDays(cursor, -1);
          continue;
        }
        break;
      }
      const allAchieved = tasks.every((t) => t.status === "achieved");
      if (!allAchieved) break;
      count += 1;
      cursor = addDays(cursor, -1);
    }
    return count;
  }, [targetsByDay, today]);

  const last14 = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i);
      const key = toKey(d);
      const tasks = targetsByDay[key] || [];
      const achieved = tasks.filter((t) => t.status === "achieved").length;
      const missed = tasks.filter((t) => t.status === "missed").length;
      days.push({ key, date: d, total: tasks.length, achieved, missed });
    }
    return days;
  }, [targetsByDay, today]);

  // Strict 3-Tier Non-Overlapping Productivity Metrics
  const overall = useMemo(() => {
    let maxProdDays = 0;
    let inBetweenDays = 0;
    let minProdDays = 0;

    Object.entries(targetsByDay).forEach(([key, tasks]) => {
      if (!tasks || tasks.length === 0) return;
      if (fromKey(key) > today) return;

      const dayTotal = tasks.length;
      const dayAchieved = tasks.filter((t) => t.status === "achieved").length;
      const rate = dayTotal > 0 ? (dayAchieved / dayTotal) * 100 : 0;

      // Tier 1: 90% or above (or 100%)
      if (rate >= 90) {
        maxProdDays += 1;
      } 
      // Tier 2: Above 50% and strictly under 90%
      else if (rate > 50 && rate < 90) {
        inBetweenDays += 1;
      } 
      // Tier 3: Less than or equal to 50%
      else if (rate <= 50) {
        minProdDays += 1;
      }
    });

    const todayKey = toKey(today);
    const todaysTasks = targetsByDay[todayKey] || [];
    const todayTotal = todaysTasks.length;
    const todayAchieved = todaysTasks.filter((t) => t.status === "achieved").length;
    const todayRate = todayTotal ? Math.round((todayAchieved / todayTotal) * 100) : 0;

    return { rate: todayRate, maxProdDays, inBetweenDays, minProdDays };
  }, [targetsByDay, today]);

  const climberPct = Math.min(100, Math.max(0, overall.rate));

  const calendarDays = useMemo(() => {
    const startOfMonth = new Date(calendarView.getFullYear(), calendarView.getMonth(), 1);
    const endOfMonth = new Date(calendarView.getFullYear(), calendarView.getMonth() + 1, 0);
    const days = [];
    const startDayOfWeek = startOfMonth.getDay();

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let d = 1; d <= endOfMonth.getDate(); d++) {
      const date = new Date(calendarView.getFullYear(), calendarView.getMonth(), d);
      days.push(date);
    }
    return days;
  }, [calendarView]);

  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      backgroundColor: "#1D1B26",
      minHeight: "100vh",
      color: "#F3EFF8",
      position: "relative",
      overflowX: "hidden",
    }}>
      <style>{`
        ${FONT_IMPORT}
        body { margin: 0; padding: 0; background: #1D1B26; }
        
        @keyframes floatCloud {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(20px); }
        }

        .kw-card {
          background: rgba(42, 38, 58, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          box-shadow: 0px 12px 32px rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .kw-input {
          background: rgba(28, 26, 40, 0.7);
          border: 1.5px solid rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          padding: 12px 16px;
          color: #FFF;
          font-family: inherit;
        }
        .kw-input::placeholder { color: #A09A8F; }
        .kw-select {
          background: rgba(28, 26, 40, 0.7);
          border: 1.5px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          padding: 6px 10px;
          color: #FFF;
          font-family: inherit;
          appearance: none;
        }
        .time-num-input {
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.2);
          color: #FFF;
          border-radius: 8px;
          width: 44px;
          padding: 4px;
          text-align: center;
          font-family: inherit;
          font-weight: 700;
        }
      `}</style>

      {/* Cute Pinterest/Canva-Style Soft Mountain Background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <svg
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="cuteSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#312B42" />
              <stop offset="50%" stopColor="#5B486B" />
              <stop offset="100%" stopColor="#A8829F" />
            </linearGradient>
            <linearGradient id="softMtn1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#806282" />
              <stop offset="100%" stopColor="#4A3B52" />
            </linearGradient>
            <linearGradient id="softMtn2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#55425C" />
              <stop offset="100%" stopColor="#2E2436" />
            </linearGradient>
            <linearGradient id="softMtn3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B2E42" />
              <stop offset="100%" stopColor="#1D1B26" />
            </linearGradient>
          </defs>

          {/* Sky Gradient */}
          <rect width="1000" height="1000" fill="url(#cuteSky)" />

          {/* Cute Soft Floating Clouds (No Big Circle) */}
          <path d="M 100 250 Q 130 210 170 230 Q 210 200 250 230 Q 280 250 260 280 H 110 Z" fill="#F4E3ED" opacity="0.2" style={{ animation: "floatCloud 14s ease-in-out infinite" }} />
          <path d="M 680 320 Q 710 280 760 300 Q 800 270 840 310 Q 870 330 850 360 H 670 Z" fill="#F4E3ED" opacity="0.25" style={{ animation: "floatCloud 18s ease-in-out infinite reverse" }} />

          {/* Pinterest Rounded Mountain Peaks */}
          <path d="M -50 1000 Q 200 480 450 1000 Z" fill="url(#softMtn1)" opacity="0.85" />
          <path d="M 300 1000 Q 600 420 880 1000 Z" fill="url(#softMtn1)" opacity="0.75" />
          <path d="M 120 1000 Q 420 540 720 1000 Z" fill="url(#softMtn2)" />
          <path d="M -100 1000 Q 180 620 520 1000 Z" fill="url(#softMtn3)" />
          <path d="M 480 1000 Q 780 640 1100 1000 Z" fill="url(#softMtn3)" />
        </svg>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        
        {/* HERO SECTION */}
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "30px 16px 40px", boxSizing: "border-box" }}>
          
          {/* TOP SMALL LIVE CLOCK & CUSTOM POMODORO TIMER */}
          <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            
            {/* Small Live Clock (12-Hour AM/PM) */}
            <div style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 20,
              padding: "6px 16px",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#F2C6DE",
              backdropFilter: "blur(10px)"
            }}>
              {formatLiveClock(now)}
            </div>

            {/* Main Pomodoro Card */}
            <div className="kw-card" style={{ width: "100%", padding: "20px 24px", textAlign: "center", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(30, 26, 42, 0.55)" }}>
              
              {/* Custom Hours & Minutes Controls */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>Focus Set:</span>
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={customHours}
                  onChange={(e) => {
                    const h = Math.max(0, parseInt(e.target.value || 0, 10));
                    setCustomHours(h);
                    applyCustomTimer(h, customMins);
                  }}
                  className="time-num-input"
                />
                <span style={{ fontSize: 11, opacity: 0.6 }}>h</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={customMins}
                  onChange={(e) => {
                    const m = Math.max(0, parseInt(e.target.value || 0, 10));
                    setCustomMins(m);
                    applyCustomTimer(customHours, m);
                  }}
                  className="time-num-input"
                />
                <span style={{ fontSize: 11, opacity: 0.6 }}>m</span>
                <button
                  onClick={() => {
                    setCustomHours(0);
                    setCustomMins(25);
                    applyCustomTimer(0, 25);
                  }}
                  style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#FFF", borderRadius: 8, padding: "4px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", marginLeft: 4 }}
                >
                  Reset 25m
                </button>
              </div>

              {/* Countdown Timer Display */}
              <div style={{ fontSize: 58, fontWeight: 800, letterSpacing: "0.04em", fontFamily: "monospace", textShadow: "0px 4px 20px rgba(0,0,0,0.3)", color: "#FFF" }}>
                {formatPomoTime(pomoTime)}
              </div>

              {/* Timer Controls */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 12 }}>
                <button
                  onClick={() => setPomoActive(!pomoActive)}
                  style={{
                    background: "#F2C6DE",
                    color: "#161521",
                    border: "none",
                    borderRadius: 999,
                    width: 46,
                    height: 46,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0px 4px 14px rgba(242, 198, 222, 0.4)"
                  }}
                >
                  {pomoActive ? <Pause size={20} fill="#161521" /> : <Play size={20} fill="#161521" style={{ marginLeft: 2 }} />}
                </button>
                <button
                  onClick={() => applyCustomTimer(customHours, customMins)}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    color: "#FFF",
                    border: "none",
                    borderRadius: 999,
                    width: 38,
                    height: 38,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* 12-Month Interactive Calendar */}
          <div className="kw-card" style={{ width: "100%", maxWidth: 360, padding: 22, margin: "20px 0" }}>
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button 
                onClick={() => setCalendarView(new Date(calendarView.getFullYear(), calendarView.getMonth() - 1, 1))} 
                style={{ background: "none", border: "none", color: "#FFF", cursor: "pointer", opacity: 0.7 }}
              >
                <ChevronLeft size={20} />
              </button>
              
              <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: 28, fontWeight: 700, color: "#F7EBE8" }}>
                {calendarView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>

              <button 
                onClick={() => setCalendarView(new Date(calendarView.getFullYear(), calendarView.getMonth() + 1, 1))} 
                style={{ background: "none", border: "none", color: "#FFF", cursor: "pointer", opacity: 0.7 }}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, textAlign: "center", fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 10 }}>
              <span>SU</span><span>MO</span><span>TU</span><span>WE</span><span>TH</span><span>FR</span><span>SA</span>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, position: "relative" }}>
              {calendarDays.map((d, idx) => {
                if (!d) return <div key={`pad-${idx}`} />;
                const key = toKey(d);
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const isPast = d < todayStart;
                const isFuture = d > todayStart;
                const isCrossed = crossedDates[key] || (isPast && crossedDates[key] !== false);
                const isTodayDate = isSameDay(d, today);

                return (
                  <button
                    key={key}
                    onClick={() => handleCrossDate(d, key)}
                    style={{
                      aspectRatio: "1/1",
                      background: isTodayDate ? "#F2C6DE" : "rgba(255,255,255,0.05)",
                      color: isTodayDate ? "#161521" : (isFuture ? "rgba(255,255,255,0.3)" : "#FFF"),
                      border: isTodayDate ? "2px solid #FFF" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: isFuture ? "default" : "pointer",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0
                    }}
                  >
                    {d.getDate()}
                    {isCrossed && !isFuture && (
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#E86F88", fontSize: 16, fontWeight: 900 }}>✕</span>
                    )}
                  </button>
                );
              })}
              
              <div style={{ position: "absolute", bottom: 4, right: 8, opacity: 0.25, pointerEvents: "none", color: "#FFF" }}>
                 {MONTH_DOODLES[calendarView.getMonth()]}
              </div>
            </div>
          </div>
          
          <div style={{ height: 10 }}></div>
        </div>

        {/* Scrollable Main Dashboard */}
        <div style={{
          background: "rgba(22, 21, 33, 0.92)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          minHeight: "100vh",
          padding: "40px 16px 80px",
          boxShadow: "0px -10px 40px rgba(0,0,0,0.4)"
        }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            
            {/* Streak & Productivity Metrics Grid (3 Tiers) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div className="kw-card" style={{ padding: 16, gridColumn: "span 2" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7, display: "flex", alignItems: "center", gap: 4 }}>
                  <Flame size={12} color="#E59866" /> STREAK
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{streak}d</div>
              </div>

              <div className="kw-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7 }}>MAX PRODUCTIVITY 🐢</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#82C99B", marginTop: 4 }}>{overall.maxProdDays}</div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>≥ 90% completed</div>
              </div>

              <div className="kw-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7 }}>IN BETWEEN 🐧</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#F3C68F", marginTop: 4 }}>{overall.inBetweenDays}</div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>&gt; 50% &amp; &lt; 90%</div>
              </div>
<div className="kw-card" style={{ padding: 16, gridColumn: "span 2" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7 }}>MIN PRODUCTIVITY 🐇</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#E86F88", marginTop: 4 }}>{overall.minProdDays}</div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>≤ 50% completed</div>
              </div>
            </div>

            {/* Climb Progress Bar with Rate of Completion directly under Climber Emoji */}
            <div className="kw-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7, marginBottom: 24 }}>TODAY'S CLIMB</div>
              <div style={{ position: "relative", height: 18, background: "rgba(20, 18, 30, 0.6)", borderRadius: 999, border: "1.5px solid rgba(255,255,255,0.15)", marginBottom: 28 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${climberPct}%`, background: "#F2C6DE", borderRadius: 999, transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                  
                  {climberPct === 100 ? (
                    <div style={{ position: "absolute", right: -10, top: -16, fontSize: 22 }}>🚩</div>
                  ) : (
                    <div style={{ position: "absolute", right: -12, top: -16, fontSize: 22, zIndex: 2 }}>
                      🧗🏻‍♀️
                      {/* Live Completion Rate under Climber */}
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#F2C6DE", textAlign: "center", position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                        {overall.rate}%
                      </div>
                    </div>
                  )}

                </div>
                {climberPct < 100 && (
                  <div style={{ position: "absolute", right: 2, top: -16, fontSize: 22, opacity: 0.8, zIndex: 1 }}>🏔️</div>
                )}
              </div>
            </div>

            {/* Last 14 Days Navigation */}
            <div className="kw-card" style={{ padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7, marginBottom: 14 }}>LAST 14 DAYS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 4 }}>
                {last14.map((d) => {
                  const isSelected = d.key === viewKey;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setViewDate(fromKey(d.key))}
                      style={{
                        background: isSelected ? "#FFF" : "rgba(28, 26, 40, 0.7)",
                        color: isSelected ? "#161521" : "#FFF",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 6,
                        height: 28,
                        width: "100%",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {d.date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes Section Card */}
            <div className="kw-card" style={{ padding: 16, marginBottom: 20, cursor: "pointer" }} onClick={() => setShowNotesModal(true)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>Notes</div>
                <Maximize2 size={14} opacity={0.6} />
              </div>
              <div style={{ fontSize: 13, opacity: notes ? 0.9 : 0.4, whiteSpace: "pre-wrap", maxHeight: 50, overflow: "hidden" }}>
                {notes || "Click to expand notes view..."}
              </div>
            </div>

            {/* Current Day Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <button onClick={() => setViewDate((d) => addDays(d, -1))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
                <ChevronLeft size={24} />
              </button>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {isToday ? "Today" : dayLabel(viewDate)}
              </div>
              <button onClick={() => setViewDate((d) => addDays(d, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
                <ChevronRight size={24} />
              </button>
            </div>

            {/* Task Input Form */}
            <div className="kw-card" style={{ padding: 18, marginBottom: 20 }}>
              <input
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="hurry up set your targets MORIKO!"
                className="kw-input"
                style={{ width: "100%", marginBottom: 14, boxSizing: "border-box", fontSize: 14 }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Clock size={16} opacity={0.7} />
                  <select value={newStart} onChange={(e) => setNewStart(e.target.value)} className="kw-select" style={{ fontSize: 13 }}>
                    <option value="">--</option>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>–</span>
                  <select value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="kw-select" style={{ fontSize: 13 }}>
                    <option value="">--</option>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <button
                  onClick={addTask}
                  style={{
                    background: "#F2C6DE",
                    border: "none",
                    color: "#161521",
                    borderRadius: 12,
                    padding: "10px 18px",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            {/* Task List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 30 }}>
              {currentTasks.map((t, index) => (
                <div key={t.id} className="kw-card" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      onClick={() => setStatus(t.id, "achieved")}
                      style={{ background: t.status === "achieved" ? "#82C99B" : "transparent", border: "2px solid #FFF", borderRadius: 8, width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {t.status === "achieved" && <Check size={16} color="#FFF" />}
                    </button>
                    <button
                      onClick={() => setStatus(t.id, "missed")}
                      style={{ background: t.status === "missed" ? "#E86F88" : "transparent", border: "2px solid #FFF", borderRadius: 8, width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {t.status === "missed" && <X size={16} color="#FFF" />}
                    </button>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, textDecoration: t.status === "achieved" ? "line-through" : "none", opacity: t.status === "achieved" ? 0.6 : 1 }}>
                        <span style={{ opacity: 0.5, marginRight: 6 }}>{index + 1}.</span>
                        {t.text}
                      </div>
                      {(t.start || t.end) && (
                        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                          {t.start && t.end ? `${t.start} – ${t.end}` : t.start || t.end}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => removeTask(t.id)} style={{ background: "none", border: "none", opacity: 0.5, cursor: "pointer", color: "inherit" }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", fontSize: 12, opacity: 0.5, fontStyle: "italic" }}>
              "a climber only fails when he stops climbing" ~ Mori
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Notes Modal */}
      {showNotesModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(22, 21, 33, 0.88)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="kw-card" style={{ width: "100%", maxWidth: 600, height: "80vh", display: "flex", flexDirection: "column", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Notes</div>
              <button onClick={() => setShowNotesModal(false)} style={{ background: "none", border: "none", color: "#FFF", cursor: "pointer" }}>
                <Minimize2 size={20} />
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => saveNotes(notes)}
              placeholder="Write your study notes, thoughts, or goals here..."
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", color: "#FFF", fontFamily: "inherit", fontSize: 15, lineHeight: 1.6 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StudyLedger />
  </React.StrictMode>
);

export default StudyLedger;