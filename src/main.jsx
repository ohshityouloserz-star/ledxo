import React, { useState, useEffect, useCallback, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { Check, X, Plus, ChevronLeft, ChevronRight, Flame, Settings2, Trash2, Clock } from "lucide-react";

// Fallback storage helper in case custom environment is missing
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
  "@import url('https://fonts.googleapis.com/css2?family=Goudy+Bookletter+1911&display=swap');";

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

const TONE_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><circle cx='1.4' cy='1.4' r='1.1' fill='%23211F33' opacity='0.5'/></svg>`
  );

function StudyLedger() {
  const [loaded, setLoaded] = useState(false);
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
      } catch (e) {
        if (!cancelled) setError("Could not load saved data. Starting fresh.");
      }
      if (!cancelled) setLoaded(true);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const saveDay = useCallback(async (key, tasks) => {
    try {
      await window.storage.set(`targets:${key}`, JSON.stringify(tasks));
    } catch (e) {
      setError("Couldn't save just now — your change is kept on screen but may not persist.");
    }
  }, []);

  const saveExamConfig = useCallback(async (cfg) => {
    try {
      await window.storage.set("exam-config", JSON.stringify(cfg));
    } catch (e) {
      setError("Couldn't save settings.");
    }
  }, []);

  const saveNotes = useCallback(async (text) => {
    try {
      await window.storage.set("notes", text);
    } catch (e) {
      setError("Couldn't save notes.");
    }
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

  const dailyMinimum = Math.max(0, Number(examConfig.dailyMinimum) || 0);

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
    let total = 0, achieved = 0, missed = 0, perfectDays = 0, belowMinDays = 0, loggedDays = 0;
    Object.entries(targetsByDay).forEach(([key, tasks]) => {
      if (!tasks || tasks.length === 0) return;
      if (fromKey(key) > today) return;
      loggedDays += 1;
      const dayAchieved = tasks.filter((t) => t.status === "achieved").length;
      tasks.forEach((t) => {
        total += 1;
        if (t.status === "achieved") achieved += 1;
        if (t.status === "missed") missed += 1;
      });
      if (dayAchieved === tasks.length) perfectDays += 1;
      if (dayAchieved < dailyMinimum) belowMinDays += 1;
    });
    return {
      total, achieved, missed,
      rate: total ? Math.round((achieved / total) * 100) : 0,
      perfectDays, belowMinDays, loggedDays,
    };
  }, [targetsByDay, today, dailyMinimum]);

  const daysUntilExam = useMemo(() => {
    if (!examConfig.date) return null;
    const exam = new Date(examConfig.date + "T00:00:00");
    return Math.ceil((exam - new Date(toKey(today) + "T00:00:00")) / (1000 * 60 * 60 * 24));
  }, [examConfig.date, today]);

  const todayCompletion = currentTasks.length
    ? Math.round((currentTasks.filter((t) => t.status === "achieved").length / currentTasks.length) * 100)
    : null;

  function formatBracket(t) {
    if (!t.start && !t.end) return null;
    if (t.start && t.end) return `${t.start}–${t.end}`;
    return t.start || t.end;
  }

  const climberPct = Math.min(96, Math.max(4, overall.rate));
  const clockLabel = now.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div style={{ fontFamily: "'Goudy Old Style', 'Goudy Bookletter 1911', serif", background: "#E7E4F3", minHeight: "100vh", color: "#2B2A3D", position: "relative", overflow: "hidden" }}>
      <style>{`
        ${FONT_IMPORT}
        .kw-title { font-family: 'Campbell', cursive; }
        .kw-card {
          background: #FBFAFF; border: 2px solid #2B2A3D; border-radius: 20px;
          box-shadow: 3px 3px 0 rgba(43,42,61,0.9);
        }
        .kw-btn { transition: transform 0.12s ease; }
        .kw-btn:hover { transform: translateY(-2px); }
        .kw-btn:active { transform: translateY(0); }
        .kw-input::placeholder { color: #ABA6C4; }
        .kw-textarea { font-family: 'Goudy Old Style', 'Goudy Bookletter 1911', serif; }
      `}</style>

      <svg
        aria-hidden="true"
        style={{ position: "fixed", left: 0, bottom: 0, width: "100%", height: "62vh", zIndex: 0 }}
        viewBox="0 0 1000 620"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="tone" width="8" height="8" patternUnits="userSpaceOnUse">
            <image href={TONE_SVG} width="8" height="8" />
          </pattern>
          <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E7E4F3" stopOpacity="0" />
            <stop offset="100%" stopColor="#E7E4F3" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <polygon points="0,300 120,220 260,280 420,180 560,260 720,190 860,270 1000,210 1000,620 0,620" fill="#8D89AA" opacity="0.55" />
        <polygon points="0,380 150,270 300,340 480,230 620,330 800,240 1000,330 1000,620 0,620" fill="#3A3555" />
        <polygon points="0,380 150,270 300,340 480,230 620,330 800,240 1000,330 1000,620 0,620" fill="url(#tone)" opacity="0.5" />
        <polygon points="0,470 90,360 180,430 260,320 340,420 430,300 520,410 610,330 700,440 800,340 900,430 1000,370 1000,620 0,620" fill="#211F33" />
        <polygon points="260,320 300,345 220,345" fill="#F1EEFA" />
        <polygon points="430,300 470,325 390,325" fill="#F1EEFA" />
        <polygon points="610,330 645,352 575,352" fill="#F1EEFA" />
        <rect x="0" y="0" width="1000" height="620" fill="url(#mist)" />
      </svg>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "36px 20px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#6E6B8A", marginBottom: 6, fontWeight: 700 }}>
              {clockLabel}
            </div>
            {examConfig.name && (
              <h1 className="kw-title" style={{ fontSize: 24, margin: 0, color: "#2B2A3D", lineHeight: 1.4 }}>
                {examConfig.name}
              </h1>
            )}
            {daysUntilExam !== null && (
              <div style={{ fontSize: 12, color: daysUntilExam < 0 ? "#ABA6C4" : "#E88BA6", marginTop: 6, fontWeight: 700 }}>
                {daysUntilExam > 0 ? `${daysUntilExam} day${daysUntilExam === 1 ? "" : "s"} to summit day 🚩` : daysUntilExam === 0 ? "Summit day is today!" : "Summit day has passed"}
              </div>
            )}
          </div>
          <button onClick={() => setShowSettings((s) => !s)} className="kw-btn kw-card" style={{ padding: 8, cursor: "pointer", color: "#2B2A3D" }}>
            <Settings2 size={16} />
          </button>
        </div>

        {error && (
          <div className="kw-card" style={{ padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#C1502E" }}>
            {error}
          </div>
        )}

        {showSettings && (
          <div className="kw-card" style={{ padding: 18, marginBottom: 22 }}>
            <div style={{ fontSize: 13, marginBottom: 12, fontWeight: 700 }}>Trip details</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <input
                value={examConfig.name}
                onChange={(e) => setExamConfig((c) => ({ ...c, name: e.target.value }))}
                onBlur={() => saveExamConfig(examConfig)}
                placeholder="Exam name"
                className="kw-input"
                style={{ flex: "1 1 180px", background: "#F1EEFA", border: "2px solid #2B2A3D", borderRadius: 12, padding: "8px 12px", color: "#2B2A3D", fontSize: 13, fontFamily: "inherit" }}
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
                style={{ background: "#F1EEFA", border: "2px solid #2B2A3D", borderRadius: 12, padding: "8px 12px", color: "#2B2A3D", fontSize: 13, fontFamily: "inherit" }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#6E6B8A", marginBottom: 6, fontWeight: 600 }}>
              Daily minimum (targets to hit for the day to count)
            </div>
            <input
              type="number"
              min="0"
              value={examConfig.dailyMinimum}
              onChange={(e) => setExamConfig((c) => ({ ...c, dailyMinimum: e.target.value }))}
              onBlur={() => saveExamConfig(examConfig)}
              className="kw-input"
              style={{ width: 90, background: "#F1EEFA", border: "2px solid #2B2A3D", borderRadius: 12, padding: "8px 12px", color: "#2B2A3D", fontSize: 13, fontFamily: "inherit" }}
            />
          </div>
        )}

        <div className="kw-card" style={{ padding: 16, marginBottom: 22 }}>
          <div style={{ color: "#6E6B8A", fontSize: 10, fontWeight: 700, marginBottom: 10, letterSpacing: "0.08em" }}>NOTES</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => saveNotes(notes)}
            placeholder="Anything extra — formulas, reminders, thoughts…"
            className="kw-input kw-textarea"
            rows={3}
            style={{ width: "100%", background: "#F1EEFA", border: "2px solid #2B2A3D", borderRadius: 12, padding: "10px 12px", color: "#2B2A3D", fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
          <div className="kw-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#6E6B8A", fontSize: 10, fontWeight: 700 }}>
              <Flame size={12} color="#E8A23A" /> STREAK
            </div>
            <div className="kw-title" style={{ fontSize: 22, marginTop: 6 }}>{streak}d</div>
          </div>
          <div className="kw-card" style={{ padding: 14 }}>
            <div style={{ color: "#6E6B8A", fontSize: 10, fontWeight: 700 }}>COMPLETION</div>
            <div className="kw-title" style={{ fontSize: 22, marginTop: 6 }}>{overall.rate}%</div>
          </div>
          <div className="kw-card" style={{ padding: 14 }}>
            <div style={{ color: "#6E6B8A", fontSize: 10, fontWeight: 700 }}>PERFECT DAYS</div>
            <div className="kw-title" style={{ fontSize: 22, marginTop: 6, color: "#5FAE83" }}>{overall.perfectDays}</div>
            <div style={{ fontSize: 10, color: "#9C97B8", marginTop: 2 }}>of {overall.loggedDays} logged</div>
          </div>
          <div className="kw-card" style={{ padding: 14 }}>
            <div style={{ color: "#6E6B8A", fontSize: 10, fontWeight: 700 }}>BELOW MINIMUM</div>
            <div className="kw-title" style={{ fontSize: 22, marginTop: 6, color: "#E8768E" }}>{overall.belowMinDays}</div>
            <div style={{ fontSize: 10, color: "#9C97B8", marginTop: 2 }}>days under {dailyMinimum}</div>
          </div>
        </div>

        <div className="kw-card" style={{ padding: 16, marginBottom: 18 }}>
          <div style={{ color: "#6E6B8A", fontSize: 10, fontWeight: 700, marginBottom: 10 }}>YOUR CLIMB</div>
          <div style={{ position: "relative", height: 14, background: "#EDEAF7", borderRadius: 999, border: "2px solid #2B2A3D", overflow: "visible" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${climberPct}%`, background: "linear-gradient(90deg, #D9CCF2, #B6A6E0)", borderRadius: 999 }} />
            <div style={{ position: "absolute", left: `calc(${climberPct}% - 10px)`, top: -14, fontSize: 18 }} title={`${overall.rate}% of the way up`}>🧗</div>
          </div>
          <div style={{ fontSize: 10, color: "#9C97B8", marginTop: 12, textAlign: "right" }}>base camp — — — — — summit</div>
        </div>

        <div className="kw-card" style={{ padding: 16, marginBottom: 22 }}>
          <div style={{ color: "#6E6B8A", fontSize: 10, fontWeight: 700, marginBottom: 10 }}>LAST 14 DAYS</div>
          <div style={{ display: "flex", gap: 4, justifyContent: "space-between" }}>
            {last14.map((d) => {
              let bg = "#EDEAF7", fg = "#ABA6C4";
              if (d.total > 0) {
                if (d.achieved === d.total) { bg = "#B6E3C6"; fg = "#20452F"; }
                else if (d.achieved > 0) { bg = "#D9CCF2"; fg = "#3A2D5C"; }
                else if (d.missed > 0) { bg = "#F5AEBB"; fg = "#5A1D28"; }
              }
              const isSelected = d.key === viewKey;
              return (
                <button
                  key={d.key}
                  onClick={() => setViewDate(fromKey(d.key))}
                  className="kw-btn kw-pill"
                  style={{
                    background: bg, color: fg, border: isSelected ? "2px solid #2B2A3D" : "2px solid transparent",
                    cursor: "pointer", fontSize: 9, fontWeight: 700, width: 20, height: 20, borderRadius: 8,
                  }}
                >
                  {d.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => setViewDate((d) => addDays(d, -1))} className="kw-btn" style={{ background: "none", border: "none", color: "#6E6B8A", cursor: "pointer", padding: 6 }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {isToday ? "Today" : dayLabel(viewDate)}
            </span>
            {todayCompletion !== null && (
              <span style={{ fontSize: 11, color: "#6E6B8A" }}>· {todayCompletion}%</span>
            )}
          </div>
          <button onClick={() => setViewDate((d) => addDays(d, 1))} className="kw-btn" style={{ background: "none", border: "none", color: "#6E6B8A", cursor: "pointer", padding: 6 }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Task Adding Input */}
        <div className="kw-card" style={{ padding: 12, marginBottom: 16 }}>
          <input
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add a target..."
            className="kw-input"
            style={{ width: "100%", background: "#F1EEFA", border: "2px solid #2B2A3D", borderRadius: 10, padding: "8px 12px", color: "#2B2A3D", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="time"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              style={{ background: "#F1EEFA", border: "2px solid #2B2A3D", borderRadius: 8, padding: "4px 8px", fontSize: 11 }}
            />
            <span style={{ fontSize: 11, color: "#6E6B8A" }}>to</span>
            <input
              type="time"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              style={{ background: "#F1EEFA", border: "2px solid #2B2A3D", borderRadius: 8, padding: "4px 8px", fontSize: 11 }}
            />
            <button onClick={addTask} className="kw-btn" style={{ marginLeft: "auto", background: "#2B2A3D", color: "#FFF", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Task List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {currentTasks.map((t) => (
            <div key={t.id} className="kw-card" style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => setStatus(t.id, "achieved")}
                  style={{ background: t.status === "achieved" ? "#5FAE83" : "#F1EEFA", border: "2px solid #2B2A3D", borderRadius: 6, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  {t.status === "achieved" && <Check size={14} color="#FFF" />}
                </button>
                <button
                  onClick={() => setStatus(t.id, "missed")}
                  style={{ background: t.status === "missed" ? "#E8768E" : "#F1EEFA", border: "2px solid #2B2A3D", borderRadius: 6, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  {t.status === "missed" && <X size={14} color="#FFF" />}
                </button>
                <div>
                  <div style={{ fontSize: 14, textDecoration: t.status === "achieved" ? "line-through" : "none", color: t.status === "achieved" ? "#9C97B8" : "#2B2A3D" }}>
                    {t.text}
                  </div>
                  {formatBracket(t) && (
                    <div style={{ fontSize: 10, color: "#6E6B8A", display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                      <Clock size={10} /> {formatBracket(t)}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => removeTask(t.id)} style={{ background: "none", border: "none", color: "#ABA6C4", cursor: "pointer" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
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