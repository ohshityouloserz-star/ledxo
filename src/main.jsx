import React, { useState, useEffect, useCallback, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { Check, X, Plus, ChevronLeft, ChevronRight, Flame, Settings2, Trash2, Clock, ChevronDown } from "lucide-react";

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

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');";

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

const TONE_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><circle cx='1.4' cy='1.4' r='1.1' fill='%23211F33' opacity='0.5'/></svg>`
  );

function StudyLedger() {
  const [viewDate, setViewDate] = useState(new Date());
  const [targetsByDay, setTargetsByDay] = useState({});
  const [examConfig, setExamConfig] = useState({ name: "", date: "", dailyMinimum: 1 });
  const [notes, setNotes] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = new Date();
  const viewKey = toKey(viewDate);
  const isToday = isSameDay(viewDate, today);

  // Time calculation for day/night background change (4 PM to 3 AM is Night)
  const currentHour = now.getHours();
  const isNight = currentHour >= 16 || currentHour < 3;
  
  // Format to 12-hour AM/PM clock
  const displayTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const cfgRes = await window.storage.get("exam-config").catch(() => null);
        if (!cancelled && cfgRes && cfgRes.value) {
          setExamConfig((prev) => ({ ...prev, ...JSON.parse(cfgRes.value) }));
        }
      } catch (e) {}
      try {
        const notesRes = await window.storage.get("notes").catch(() => null);
        if (!cancelled && notesRes && typeof notesRes.value === "string") {
          setNotes(notesRes.value);
        }
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
    let total = 0, achieved = 0, missed = 0, maxProdDays = 0, minProdDays = 0, loggedDays = 0;
    Object.entries(targetsByDay).forEach(([key, tasks]) => {
      if (!tasks || tasks.length === 0) return;
      if (fromKey(key) > today) return;
      loggedDays += 1;
      
      const dayTotal = tasks.length;
      const dayAchieved = tasks.filter((t) => t.status === "achieved").length;
      const uncompleted = dayTotal - dayAchieved; // Exactly how many are pending

      tasks.forEach((t) => {
        total += 1;
        if (t.status === "achieved") achieved += 1;
        if (t.status === "missed") missed += 1;
      });

      // Minimum productivity 🐇: at least half complete (50%+)
      if (dayTotal > 0 && (dayAchieved / dayTotal) >= 0.5) {
        minProdDays += 1;
      }

      // Maximum productivity 🐢: exactly 1, 2, or 3 tasks pending
      if (dayTotal > 0 && uncompleted >= 1 && uncompleted <= 3) {
        maxProdDays += 1;
      }
    });

    return {
      total, achieved, missed,
      rate: total ? Math.round((achieved / total) * 100) : 0,
      maxProdDays, minProdDays, loggedDays,
    };
  }, [targetsByDay, today]);

  const climberPct = Math.min(100, Math.max(0, overall.rate));

  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      backgroundColor: isNight ? "#12101A" : "#D4C5ED",
      minHeight: "100vh",
      color: isNight ? "#F0EDF6" : "#211F33",
      position: "relative",
      overflowX: "hidden",
      scrollBehavior: "smooth"
    }}>
      <style>{`
        ${FONT_IMPORT}
        body { margin: 0; padding: 0; }
        .kw-card {
          background: ${isNight ? "rgba(40, 37, 59, 0.7)" : "rgba(247, 245, 252, 0.7)"};
          border: 2px solid ${isNight ? "#484360" : "#211F33"};
          border-radius: 20px;
          box-shadow: 4px 4px 0px ${isNight ? "rgba(18, 16, 26, 0.8)" : "rgba(33, 31, 51, 0.8)"};
          backdrop-filter: blur(8px);
        }
        .kw-input {
          background: ${isNight ? "rgba(31, 29, 43, 0.8)" : "rgba(237, 232, 245, 0.8)"};
          border: 2px solid ${isNight ? "#484360" : "#211F33"};
          border-radius: 12px;
          padding: 10px 14px;
          color: ${isNight ? "#FFF" : "#211F33"};
          font-family: inherit;
        }
        .kw-input::placeholder { color: ${isNight ? "#787293" : "#8F8AA8"}; }
        .kw-select {
          background: ${isNight ? "rgba(31, 29, 43, 0.8)" : "rgba(237, 232, 245, 0.8)"};
          border: 2px solid ${isNight ? "#484360" : "#211F33"};
          border-radius: 10px;
          padding: 6px 10px;
          color: ${isNight ? "#FFF" : "#211F33"};
          font-family: inherit;
          appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238F8AA8' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>");
          background-repeat: no-repeat;
          background-position: right 8px center;
          padding-right: 24px;
        }
        @keyframes flipHourglass {
          0%, 45% { transform: rotate(0deg); }
          50%, 95% { transform: rotate(180deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes bounceScroll {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(10px); }
        }
        .hg-animated {
          display: inline-block;
          animation: flipHourglass 4s infinite ease-in-out;
        }
        .bounce-icon {
          animation: bounceScroll 2s infinite ease-in-out;
        }
      `}</style>

      {/* Dramatic Manga-Inspired Full Screen Fixed Background */}
      <svg
        aria-hidden="true"
        style={{ position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh", zIndex: 0, objectFit: "cover", transition: "all 1s ease" }}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <pattern id="tone" width="8" height="8" patternUnits="userSpaceOnUse">
            <image href={TONE_SVG} width="8" height="8" />
          </pattern>
        </defs>
        <rect width="1000" height="1000" fill={isNight ? "#1C1A27" : "#E5E1EE"} />
        <polygon points="-100,600 200,250 450,550 700,100 1100,600 1100,1000 -100,1000" fill={isNight ? "#2C2742" : "#7E779A"} opacity="0.4" />
        <polygon points="-50,750 300,400 550,600 850,250 1100,650 1100,1000 -50,1000" fill={isNight ? "#181524" : "#3D3854"} />
        <polygon points="-50,750 300,400 550,600 850,250 1100,650 1100,1000 -50,1000" fill="url(#tone)" opacity="0.4" />
        <polygon points="-100,900 150,600 350,750 600,450 850,750 1100,500 1100,1000 -100,1000" fill={isNight ? "#0D0B14" : "#211F33"} />
      </svg>

      <div style={{ position: "relative", zIndex: 1 }}>
        
        {/* 100vh Hero Screen (Just Timer & Scroll indicator) */}
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "24px 16px", boxSizing: "border-box" }}>
          <div style={{ width: "100%", maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="kw-card" style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700 }}>
              <span className="hg-animated">⏳</span>
              <span>{displayTime}</span>
            </div>
            <button onClick={() => setShowSettings((s) => !s)} className="kw-card" style={{ padding: "10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <Settings2 size={18} />
            </button>
          </div>

          {/* Settings Panel (Pops over hero if active) */}
          {showSettings && (
            <div className="kw-card" style={{ maxWidth: 600, width: "100%", margin: "20px auto 0", padding: 18 }}>
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
                <input
                  type="date"
                  value={examConfig.date}
                  onChange={(e) => {
                    const cfg = { ...examConfig, date: e.target.value };
                    setExamConfig(cfg);
                    saveExamConfig(cfg);
                  }}
                  className="kw-input"
                />
              </div>
            </div>
          )}

          <div style={{ flex: 1 }} />
          
          <div style={{ textAlign: "center", paddingBottom: 40, opacity: 0.8, color: isNight ? "#D4C5ED" : "#FFF", textShadow: "0px 2px 4px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>SCROLL TO CLIMB</div>
            <div className="bounce-icon"><ChevronDown size={32} margin="0 auto" /></div>
          </div>
        </div>

        {/* Scrollable Main Application Window */}
        <div style={{
          background: isNight ? "rgba(22, 20, 31, 0.8)" : "rgba(229, 225, 238, 0.75)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: `2px solid ${isNight ? "#484360" : "#211F33"}`,
          minHeight: "100vh",
          padding: "40px 16px 80px",
          boxShadow: "0px -10px 40px rgba(0,0,0,0.3)"
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
                <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7 }}>COMPLETION</div>
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
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>≥50% completed</div>
              </div>
            </div>

            {/* Climb Progress Bar */}
            <div className="kw-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7, marginBottom: 20 }}>YOUR CLIMB</div>
              <div style={{ position: "relative", height: 18, background: isNight ? "rgba(31, 29, 43, 0.8)" : "rgba(237, 232, 245, 0.8)", borderRadius: 999, border: `2px solid ${isNight ? "#484360" : "#211F33"}` }}>
                
                {/* The Filled Progress Line */}
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${climberPct}%`, background: "#D4C5ED", borderRadius: 999, transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                  
                  {/* Climber / Flag anchored to the exact right edge of the fill */}
                  {climberPct === 100 ? (
                    <div style={{ position: "absolute", right: -10, top: -16, fontSize: 22, textShadow: "2px 2px 0px rgba(0,0,0,0.2)" }}>🚩</div>
                  ) : (
                    <div style={{ position: "absolute", right: -12, top: -16, fontSize: 22, zIndex: 2 }}>🧗🏻‍♀️</div>
                  )}
                </div>

                {/* The Mountain Summit fixed at the far right */}
                {climberPct < 100 && (
                  <div style={{ position: "absolute", right: 2, top: -16, fontSize: 22, opacity: 0.8, zIndex: 1 }}>🏔️</div>
                )}
              </div>
              <div style={{ fontSize: 10, opacity: 0.6, textAlign: "right", marginTop: 10 }}>
                base camp — — — — — summit
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
                        background: isSelected ? (isNight ? "#FFF" : "#211F33") : (isNight ? "rgba(31, 29, 43, 0.8)" : "rgba(237, 232, 245, 0.8)"),
                        color: isSelected ? (isNight ? "#211F33" : "#FFF") : (isNight ? "#FFF" : "#211F33"),
                        border: `1.5px solid ${isNight ? "#484360" : "#211F33"}`,
                        borderRadius: 6,
                        height: 28,
                        width: "100%",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        boxShadow: isSelected ? "1px 1px 0px rgba(0,0,0,0.3)" : "none"
                      }}
                    >
                      {d.date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes Section */}
            <div className="kw-card" style={{ padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, marginBottom: 8 }}>Notes</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => saveNotes(notes)}
                placeholder="Add quick notes or reminders here..."
                rows={2}
                style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", color: "inherit", fontFamily: "inherit", fontSize: 13, lineHeight: "1.5" }}
              />
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
                    boxShadow: "2px 2px 0px #211F33"
                  }}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            {/* Task List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 30 }}>
              {currentTasks.map((t) => (
                <div key={t.id} className="kw-card" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      onClick={() => setStatus(t.id, "achieved")}
                      style={{ background: t.status === "achieved" ? "#489A6A" : "transparent", border: `2px solid ${isNight ? "#FFF" : "#211F33"}`, borderRadius: 8, width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {t.status === "achieved" && <Check size={16} color="#FFF" />}
                    </button>
                    <button
                      onClick={() => setStatus(t.id, "missed")}
                      style={{ background: t.status === "missed" ? "#D95D75" : "transparent", border: `2px solid ${isNight ? "#FFF" : "#211F33"}`, borderRadius: 8, width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {t.status === "missed" && <X size={16} color="#FFF" />}
                    </button>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, textDecoration: t.status === "achieved" ? "line-through" : "none", opacity: t.status === "achieved" ? 0.6 : 1 }}>
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

            {/* Footer Quote */}
            <div style={{ textAlign: "center", fontSize: 12, opacity: 0.5, fontStyle: "italic" }}>
              "a climber only fails when he stops climbing" ~ Mori
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StudyLedger />
  </React.StrictMode>
);

export default StudyLedger;