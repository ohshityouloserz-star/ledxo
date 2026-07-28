import React, { useState, useEffect, useCallback, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { Check, X, Plus, ChevronLeft, ChevronRight, Flame, Settings2, Trash2, Clock } from "lucide-react";

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
      const uncompleted = dayTotal - dayAchieved;

      tasks.forEach((t) => {
        total += 1;
        if (t.status === "achieved") achieved += 1;
        if (t.status === "missed") missed += 1;
      });

      // Minimum productivity 🐇: at least half complete (50%+)
      if (dayTotal > 0 && dayAchieved / dayTotal >= 0.5) {
        minProdDays += 1;
      }

      // Maximum productivity 🐢: only 1, 2, or 3 tasks left uncompleted
      if (uncompleted >= 1 && uncompleted <= 3) {
        maxProdDays += 1;
      }
    });

    return {
      total, achieved, missed,
      rate: total ? Math.round((achieved / total) * 100) : 0,
      maxProdDays, minProdDays, loggedDays,
    };
  }, [targetsByDay, today]);

  const climberPct = Math.min(94, Math.max(6, overall.rate));

  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      background: isNight ? "#1C1A27" : "#E5E1EE",
      minHeight: "100vh",
      color: isNight ? "#F0EDF6" : "#211F33",
      position: "relative",
      overflow: "hidden",
      transition: "background 1s ease"
    }}>
      <style>{`
        ${FONT_IMPORT}
        .kw-card {
          background: ${isNight ? "#28253B" : "#F7F5FC"};
          border: 2px solid ${isNight ? "#484360" : "#211F33"};
          border-radius: 20px;
          box-shadow: 4px 4px 0px ${isNight ? "#12101A" : "#211F33"};
        }
        .kw-input {
          background: ${isNight ? "#1F1D2B" : "#EDE8F5"};
          border: 2px solid ${isNight ? "#484360" : "#211F33"};
          border-radius: 12px;
          padding: 10px 14px;
          color: ${isNight ? "#FFF" : "#211F33"};
          font-family: inherit;
        }
        .kw-input::placeholder { color: ${isNight ? "#787293" : "#8F8AA8"}; }
        .kw-select {
          background: ${isNight ? "#1F1D2B" : "#EDE8F5"};
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
        .hg-animated {
          display: inline-block;
          animation: flipHourglass 4s infinite ease-in-out;
        }
      `}</style>

      {/* Dynamic Animated Mountain Background */}
      <svg
        aria-hidden="true"
        style={{ position: "fixed", left: 0, bottom: 0, width: "100%", height: "55vh", zIndex: 0, pointerEvents: "none", transition: "all 1s ease" }}
        viewBox="0 0 1000 620"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="tone" width="8" height="8" patternUnits="userSpaceOnUse">
            <image href={TONE_SVG} width="8" height="8" />
          </pattern>
        </defs>
        <polygon points="0,320 180,210 380,310 600,180 820,290 1000,220 1000,620 0,620" fill={isNight ? "#2C2742" : "#7E779A"} opacity="0.4" />
        <polygon points="0,410 220,280 440,360 680,240 880,340 1000,280 1000,620 0,620" fill={isNight ? "#181524" : "#3D3854"} />
        <polygon points="0,410 220,280 440,360 680,240 880,340 1000,280 1000,620 0,620" fill="url(#tone)" opacity="0.4" />
        <polygon points="0,490 140,380 280,450 420,330 560,430 720,320 860,430 1000,360 1000,620 0,620" fill={isNight ? "#0D0B14" : "#211F33"} />
      </svg>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto", padding: "24px 16px 60px" }}>
        
        {/* ADHD Friendly Live Timer Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="kw-card" style={{ padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
            <span className="hg-animated">⏳</span>
            <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <button onClick={() => setShowSettings((s) => !s)} className="kw-card" style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <Settings2 size={16} />
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="kw-card" style={{ padding: 18, marginBottom: 18 }}>
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

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div className="kw-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7, display: "flex", alignItems: "center", gap: 4 }}>
              <Flame size={12} color="#D9822B" /> STREAK
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{streak}d</div>
          </div>
          <div className="kw-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7 }}>COMPLETION</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{overall.rate}%</div>
          </div>
          <div className="kw-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7 }}>MAXIMUM PRODUCTIVITY 🐢</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#489A6A", marginTop: 4 }}>{overall.maxProdDays}</div>
            <div style={{ fontSize: 10, opacity: 0.6 }}>1-3 tasks pending</div>
          </div>
          <div className="kw-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7 }}>MINIMUM PRODUCTIVITY 🐇</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#D95D75", marginTop: 4 }}>{overall.minProdDays}</div>
            <div style={{ fontSize: 10, opacity: 0.6 }}>≥50% completed</div>
          </div>
        </div>

        {/* Climb Progress Bar */}
        <div className="kw-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7, marginBottom: 12 }}>YOUR CLIMB</div>
          <div style={{ position: "relative", height: 16, background: isNight ? "#1F1D2B" : "#EDE8F5", borderRadius: 999, border: `2px solid ${isNight ? "#484360" : "#211F33"}` }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${climberPct}%`, background: "#D4C5ED", borderRadius: 999 }} />
            
            {/* Dynamic Climber & Summit Emoji */}
            {climberPct >= 94 ? (
              <div style={{ position: "absolute", right: 6, top: -14, fontSize: 18 }}>🚩</div>
            ) : (
              <>
                <div style={{ position: "absolute", left: `calc(${climberPct}% - 12px)`, top: -14, fontSize: 18 }}>🧗🏻‍♀️</div>
                <div style={{ position: "absolute", right: 6, top: -14, fontSize: 18 }}>🏔️</div>
              </>
            )}
          </div>
          <div style={{ fontSize: 10, opacity: 0.6, textAlign: "right", marginTop: 8 }}>
            base camp — — — — — summit
          </div>
        </div>

        {/* Last 14 Days Container with Fixed Alignment */}
        <div className="kw-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7, marginBottom: 12 }}>LAST 14 DAYS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 4 }}>
            {last14.map((d) => {
              const isSelected = d.key === viewKey;
              return (
                <button
                  key={d.key}
                  onClick={() => setViewDate(fromKey(d.key))}
                  style={{
                    background: isSelected ? (isNight ? "#FFF" : "#211F33") : (isNight ? "#1F1D2B" : "#EDE8F5"),
                    color: isSelected ? (isNight ? "#211F33" : "#FFF") : (isNight ? "#FFF" : "#211F33"),
                    border: `1.5px solid ${isNight ? "#484360" : "#211F33"}`,
                    borderRadius: 6,
                    height: 26,
                    width: "100%",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0
                  }}
                >
                  {d.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes Card - Placed right before TODAY section */}
        <div className="kw-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, marginBottom: 6 }}>Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => saveNotes(notes)}
            placeholder="Add quick notes or reminders here..."
            rows={2}
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", color: "inherit", fontFamily: "inherit", fontSize: 13 }}
          />
        </div>

        {/* Day Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button onClick={() => setViewDate((d) => addDays(d, -1))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {isToday ? "Today" : dayLabel(viewDate)}
          </div>
          <button onClick={() => setViewDate((d) => addDays(d, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Task Form */}
        <div className="kw-card" style={{ padding: 16, marginBottom: 16 }}>
          <input
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="hurry up set your targets MORIKO!"
            className="kw-input"
            style={{ width: "100%", marginBottom: 12, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={14} opacity={0.7} />
              <select value={newStart} onChange={(e) => setNewStart(e.target.value)} className="kw-select" style={{ fontSize: 12 }}>
                <option value="">--</option>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span style={{ fontSize: 12, opacity: 0.6 }}>–</span>
              <select value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="kw-select" style={{ fontSize: 12 }}>
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
               padding: "8px 16px",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                boxShadow: "2px 2px 0px #211F33"
              }}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Task List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {currentTasks.map((t) => (
            <div key={t.id} className="kw-card" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => setStatus(t.id, "achieved")}
                  style={{ background: t.status === "achieved" ? "#489A6A" : "transparent", border: `2px solid ${isNight ? "#FFF" : "#211F33"}`, borderRadius: 6, width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {t.status === "achieved" && <Check size={14} color="#FFF" />}
                </button>
                <button
                  onClick={() => setStatus(t.id, "missed")}
                  style={{ background: t.status === "missed" ? "#D95D75" : "transparent", border: `2px solid ${isNight ? "#FFF" : "#211F33"}`, borderRadius: 6, width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {t.status === "missed" && <X size={14} color="#FFF" />}
                </button>
                <div>
                  <div style={{ fontSize: 14, textDecoration: t.status === "achieved" ? "line-through" : "none", opacity: t.status === "achieved" ? 0.6 : 1 }}>
                    {t.text}
                  </div>
                  {(t.start || t.end) && (
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                      {t.start && t.end ? `${t.start} – ${t.end}` : t.start || t.end}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => removeTask(t.id)} style={{ background: "none", border: "none", opacity: 0.6, cursor: "pointer", color: "inherit" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Footer Quote */}
        <div style={{ textAlign: "center", fontSize: 12, opacity: 0.6, fontStyle: "italic", marginTop: 20 }}>
          "a climber only fails when he stops climbing" ~ Mori
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