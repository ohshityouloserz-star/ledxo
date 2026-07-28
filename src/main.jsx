import React, { useState, useEffect, useCallback, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { Check, X, Plus, ChevronLeft, ChevronRight, Flame, Settings2, Trash2, Clock, Maximize2, Minimize2, Snowflake, Heart, Wind, Umbrella, Sun, Zap, Cloud, Feather, Coffee, Moon, Star, Compass } from "lucide-react";

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

// Doodles mapped to months (Jan-Dec)
const MONTH_DOODLES = [
  <Snowflake size={20} strokeWidth={1.5} />, // Jan
  <Heart size={20} strokeWidth={1.5} />,     // Feb
  <Wind size={20} strokeWidth={1.5} />,      // Mar
  <Umbrella size={20} strokeWidth={1.5} />,  // Apr
  <Sun size={20} strokeWidth={1.5} />,       // May
  <Zap size={20} strokeWidth={1.5} />,       // Jun
  <Cloud size={20} strokeWidth={1.5} />,     // Jul
  <Feather size={20} strokeWidth={1.5} />,   // Aug
  <Coffee size={20} strokeWidth={1.5} />,    // Sep
  <Moon size={20} strokeWidth={1.5} />,      // Oct
  <Star size={20} strokeWidth={1.5} />,      // Nov
  <Compass size={20} strokeWidth={1.5} />    // Dec
];

function StudyLedger() {
  const [viewDate, setViewDate] = useState(new Date());
  const [targetsByDay, setTargetsByDay] = useState({});
  const [examConfig, setExamConfig] = useState({ name: "", date: "", dailyMinimum: 1 });
  const [notes, setNotes] = useState("");
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [crossedDates, setCrossedDates] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());
  
  // Calendar View State (defaults to current month)
  const [calendarView, setCalendarView] = useState(new Date(now.getFullYear(), now.getMonth(), 1));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = useMemo(() => new Date(), [now.toDateString()]);
  const viewKey = toKey(viewDate);
  const isToday = isSameDay(viewDate, today);

  const displayTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const cfgRes = await window.storage.get("exam-config").catch(() => null);
        if (!cancelled && cfgRes && cfgRes.value) setExamConfig((prev) => ({ ...prev, ...JSON.parse(cfgRes.value) }));
      } catch (e) {}
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
    } catch (e) {
      setError("Couldn't save changes.");
    }
  }, []);

  const saveExamConfig = useCallback(async (cfg) => {
    try {
      await window.storage.set("exam-config", JSON.stringify(cfg));
    } catch (e) {}
  }, []);

  const saveNotes = useCallback(async (text) => {
    try {
      await window.storage.set("notes", text);
    } catch (e) {}
  }, []);

  const handleCrossDate = useCallback((date, key) => {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (date > todayStart) return; // Prevent crossing future dates
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

  const overall = useMemo(() => {
    let maxProdDays = 0, minProdDays = 0;

    Object.entries(targetsByDay).forEach(([key, tasks]) => {
      if (!tasks || tasks.length === 0) return;
      if (fromKey(key) > today) return;

      const dayTotal = tasks.length;
      const dayAchieved = tasks.filter((t) => t.status === "achieved").length;
      const uncompleted = dayTotal - dayAchieved;

      if (uncompleted >= 1 && uncompleted <= 3) {
        maxProdDays += 1;
      } else if (dayTotal > 0 && (dayAchieved / dayTotal) <= 0.5) {
        minProdDays += 1;
      }
    });

    const todayKey = toKey(today);
    const todaysTasks = targetsByDay[todayKey] || [];
    const todayTotal = todaysTasks.length;
    const todayAchieved = todaysTasks.filter((t) => t.status === "achieved").length;
    const todayRate = todayTotal ? Math.round((todayAchieved / todayTotal) * 100) : 0;

    return { rate: todayRate, maxProdDays, minProdDays };
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
      backgroundColor: "#0D0C12",
      minHeight: "100vh",
      color: "#F0EDF6",
      position: "relative",
      overflowX: "hidden",
    }}>
      <style>{`
        ${FONT_IMPORT}
        body { margin: 0; padding: 0; background: #0D0C12; }
        .kw-card {
          background: rgba(28, 26, 40, 0.65);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 20px;
          box-shadow: 0px 8px 32px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .kw-input {
          background: rgba(20, 18, 30, 0.85);
          border: 2px solid #3D3852;
          border-radius: 12px;
          padding: 12px 16px;
          color: #FFF;
          font-family: inherit;
        }
        .kw-input::placeholder { color: #787293; }
        .kw-select {
          background: rgba(20, 18, 30, 0.85);
          border: 2px solid #3D3852;
          border-radius: 10px;
          padding: 6px 10px;
          color: #FFF;
          font-family: inherit;
          appearance: none;
        }
        @keyframes flipHourglass {
          0%, 45% { transform: rotate(0deg); }
          50%, 95% { transform: rotate(180deg); }
          100% { transform: rotate(360deg); }
        }
        .hg-animated {
          display: inline-block;
          animation: flipHourglass 4s infinite ease-in-out;
        }
      `}</style>

      {/* Realistic Mountain Background Image + Gradient Overlay */}
      <div style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0,
        backgroundImage: `linear-gradient(to bottom, rgba(13, 12, 18, 0.2) 0%, rgba(13, 12, 18, 0.8) 50%, #0D0C12 100%), url('https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?q=80&w=2070&auto=format&fit=crop')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        pointerEvents: "none"
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        
        {/* HERO SECTION */}
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "32px 16px 48px", boxSizing: "border-box" }}>
          
          <div style={{ width: "100%", maxWidth: 600, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setShowSettings((s) => !s)} className="kw-card" style={{ padding: "10px", cursor: "pointer", display: "flex", alignItems: "center", color: "#FFF" }}>
              <Settings2 size={18} />
            </button>
          </div>

          {showSettings && (
            <div className="kw-card" style={{ maxWidth: 600, width: "100%", padding: 18, margin: "10px 0" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Exam Settings</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={examConfig.name}
                  onChange={(e) => setExamConfig((c) => ({ ...c, name: e.target.value }))}
                  onBlur={() => saveExamConfig(examConfig)}
                  placeholder="Exam Name"
                  className="kw-input"
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          )}

          {/* Large Live Clock */}
          <div className="kw-card" style={{ padding: "14px 28px", borderRadius: 999, display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(28, 26, 40, 0.45)" }}>
            <span className="hg-animated" style={{ fontSize: 22 }}>⏳</span>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.05em", color: "#FFF" }}>{displayTime}</span>
          </div>

          {/* 12-Month Interactive Calendar */}
          <div className="kw-card" style={{ width: "100%", maxWidth: 360, padding: 24, margin: "20px 0", position: "relative" }}>
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <button 
                onClick={() => setCalendarView(new Date(calendarView.getFullYear(), calendarView.getMonth() - 1, 1))} 
                style={{ background: "none", border: "none", color: "#FFF", cursor: "pointer", opacity: 0.6 }}
              >
                <ChevronLeft size={20} />
              </button>
              
              {/* Beautiful Cursive Month Name */}
              <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: 28, fontWeight: 700, color: "#EBE5F5" }}>
                {calendarView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>

              <button 
                onClick={() => setCalendarView(new Date(calendarView.getFullYear(), calendarView.getMonth() + 1, 1))} 
                style={{ background: "none", border: "none", color: "#FFF", cursor: "pointer", opacity: 0.6 }}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, textAlign: "center", fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 12 }}>
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
                      background: isTodayDate ? "#D4C5ED" : "rgba(255,255,255,0.03)",
                      color: isTodayDate ? "#12101A" : (isFuture ? "rgba(255,255,255,0.3)" : "#FFF"),
                      border: isTodayDate ? "2px solid #FFF" : "1px solid rgba(255,255,255,0.05)",
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
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#D95D75", fontSize: 16, fontWeight: 900 }}>✕</span>
                    )}
                  </button>
                );
              })}
              
              {/* Dynamic Doodle in Calendar Empty Space */}
              <div style={{ position: "absolute", bottom: 4, right: 8, opacity: 0.2, pointerEvents: "none", color: "#FFF" }}>
                 {MONTH_DOODLES[calendarView.getMonth()]}
              </div>
            </div>
          </div>
          
          {/* Spacer to push content up, "SCROLL FOR LEDGER" removed */}
          <div style={{ height: 20 }}></div>
        </div>

        {/* Scrollable Main Dashboard */}
        <div style={{
          background: "rgba(13, 12, 18, 0.95)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          minHeight: "100vh",
          padding: "40px 16px 80px",
          boxShadow: "0px -10px 40px rgba(0,0,0,0.6)"
        }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            
            {/* Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div className="kw-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7, display: "flex", alignItems: "center", gap: 4 }}>
                  <Flame size={12} color="#D9822B" /> STREAK
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{streak}d</div>
              </div>
              <div className="kw-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7 }}>TODAY'S COMPLETION</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{overall.rate}%</div>
              </div>
              <div className="kw-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7 }}>MAX PRODUCTIVITY 🐢</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#489A6A", marginTop: 6 }}>{overall.maxProdDays}</div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>1-3 tasks pending</div>
              </div>
              <div className="kw-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7 }}>MIN PRODUCTIVITY 🐇</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#D95D75", marginTop: 6 }}>{overall.minProdDays}</div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>≤50% completed</div>
              </div>
            </div>

            {/* Climb Progress Bar */}
            <div className="kw-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7, marginBottom: 20 }}>TODAY'S CLIMB</div>
              <div style={{ position: "relative", height: 18, background: "rgba(20, 18, 30, 0.85)", borderRadius: 999, border: "2px solid #3D3852" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${climberPct}%`, background: "#D4C5ED", borderRadius: 999, transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                  {climberPct === 100 ? (
                    <div style={{ position: "absolute", right: -10, top: -16, fontSize: 22 }}>🚩</div>
                  ) : (
                    <div style={{ position: "absolute", right: -12, top: -16, fontSize: 22, zIndex: 2 }}>🧗🏻‍♀️</div>
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
                        background: isSelected ? "#FFF" : "rgba(20, 18, 30, 0.85)",
                        color: isSelected ? "#12101A" : "#FFF",
                        border: "1.5px solid #3D3852",
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
                    background: "#D4C5ED",
                    border: "2px solid #211F33",
                    color: "#211F33",
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
                      style={{ background: t.status === "achieved" ? "#489A6A" : "transparent", border: "2px solid #FFF", borderRadius: 8, width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {t.status === "achieved" && <Check size={16} color="#FFF" />}
                    </button>
                    <button
                      onClick={() => setStatus(t.id, "missed")}
                      style={{ background: t.status === "missed" ? "#D95D75" : "transparent", border: "2px solid #FFF", borderRadius: 8, width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
        <div style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(10, 9, 15, 0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
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