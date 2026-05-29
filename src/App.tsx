import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import {
  Activity, AlertCircle, Apple, Award, Beef, Calendar, Check, Download, Droplets, Dumbbell, Edit2, Flame,
  Footprints, Heart, Moon, Plus, RotateCcw, Save, Sun, Target, Trash2, TrendingUp,
  Upload, Utensils, Watch, X, Zap
} from "lucide-react";
import AICoach from "./AICoach";

/* ---------- Types ---------- */
type Workout = {
  id: string;
  type: "run" | "walk" | "hike" | "recovery";
  km: number;
  steps: number;
  duration: number;
  pace: string;
  calories: number;
  heartRate: number;
  time: string;
  notes?: string;
  title: string;
};

type Exercise = {
  id: string;
  name: string;
  reps: number;
  sets: number;
  duration: number; // seconds per set
  calories: number;
  time: string;
  notes?: string;
};

type Food = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
};

type WaterLog = { id: string; amount: number; time: string };

type SleepLog = {
  id: string;
  bedTime: string;
  wakeTime: string;
  hours: number;
  isNap: boolean;
};

type DayJournal = {
  date: string;
  workouts: Workout[];
  exercises: Exercise[];
  foods: Food[];
  water: WaterLog[];
  sleepLogs: SleepLog[];
  finished?: boolean;
  rating?: number;
};

/* ---------- Helpers ---------- */
const STORAGE_KEY = "alokesh-fitness-v1";
const fmt = (n: number, d = 1) => n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
const uid = () => Math.random().toString(36).slice(2, 9);
const todayISO = () => new Date().toISOString().slice(0, 10);
const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const STEPS_PER_KM = { walk: 1320, run: 1320, hike: 1280, recovery: 1350 };
const decodeSteps = (type: Workout["type"], km: number) => Math.round(km * STEPS_PER_KM[type]);
const calcCalories = (type: Workout["type"], km: number, weight = 72) => {
  const kcalPerKm: Record<string, number> = { run: 1.036, walk: 0.53, hike: 0.7, recovery: 0.45 };
  return Math.round(km * weight * kcalPerKm[type]);
};
const calcPace = (minutes: number, km: number) => {
  if (!km) return "0:00";
  const s = (minutes * 60) / km;
  return `${Math.floor(s / 60)}:${Math.round(s % 60).toString().padStart(2, "0")}`;
};
const calcSleepHours = (bed: string, wake: string) => {
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  let diff = (wh * 60 + wm) - (bh * 60 + bm);
  if (diff < 0) diff += 24 * 60;
  return Number((diff / 60).toFixed(1));
};
const calcExerciseCalories = (name: string, reps: number, sets: number) => {
  const calPerRep: Record<string, number> = { "push-up": 0.5, "pull-up": 1, "squat": 0.4, "jumping-jack": 0.2, "burpee": 1.5, plank: 0.1, "jaw-exercise": 0.05, situp: 0.3, lunge: 0.4, "arm-circle": 0.1 };
  const key = Object.keys(calPerRep).find(k => name.toLowerCase().includes(k)) || "push-up";
  return Math.round(calPerRep[key] * reps * sets);
};

/* ---------- Animated Counter ---------- */
function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const start = prevRef.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(step);
      else prevRef.current = value;
    };
    requestAnimationFrame(step);
  }, [value, duration]);
  return <>{display < 100 ? display.toFixed(1) : Math.round(display).toLocaleString()}</>;
}

/* ========== APP ========== */
export default function App() {
  const [journal, setJournal] = useState<Record<string, DayJournal>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return {};
  });
  const [date, setDate] = useState(todayISO());
  const [showAdd, setShowAdd] = useState<"workout" | "food" | "water" | "sleep" | "exercise" | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [waterPop, setWaterPop] = useState(false);
  const [coachNotif, setCoachNotif] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importMsg, setImportMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notifCounter = useRef(0);

  const handleDownload = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "AlokeshFitness",
      data: journal,
    };
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alokesh-fitness-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setImportMsg({ text: `Bhal! ${Object.keys(journal).length} din-ta data download korli! 💾`, type: "success" });
    setTimeout(() => setImportMsg(null), 4000);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result as string;
        const parsed = JSON.parse(raw);
        const data = parsed.data ?? parsed;
        if (typeof data !== "object" || data === null) throw new Error("Invalid");
        setJournal(data);
        setShowImport(false);
        setImportMsg({ text: `✅ Bhal korli! ${Object.keys(data).length} din-ta data import korli!`, type: "success" });
        setTimeout(() => setImportMsg(null), 4000);
      } catch {
        setImportMsg({ text: `❌ Boka file! Valid AlokeshFitness backup nao. Try again.`, type: "error" });
        setTimeout(() => setImportMsg(null), 4000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const dayCount = Object.keys(journal).length;

  const triggerCoachNotif = useCallback((event: string) => {
    notifCounter.current += 1;
    setCoachNotif(event + ":" + notifCounter.current);
  }, []);

  const day = journal[date] ?? { date, workouts: [], exercises: [], foods: [], water: [], sleepLogs: [] };

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(journal)); }, [journal]);

  const totals = useMemo(() => {
    const runKm = day.workouts.filter(w => w.type === "run" || w.type === "hike").reduce((a, b) => a + b.km, 0);
    const walkKm = day.workouts.filter(w => w.type === "walk" || w.type === "recovery").reduce((a, b) => a + b.km, 0);
    const steps = day.workouts.reduce((a, b) => a + b.steps, 0);
    const caloriesOut = day.workouts.reduce((a, b) => a + b.calories, 0) + day.exercises.reduce((a, b) => a + b.calories, 0);
    const caloriesIn = day.foods.reduce((a, b) => a + b.calories, 0);
    const waterMl = day.water.reduce((a, b) => a + b.amount, 0);
    const protein = day.foods.reduce((a, b) => a + b.protein, 0);
    const sleepHrs = day.sleepLogs.filter(s => !s.isNap).reduce((a, b) => a + b.hours, 0);
    const napHrs = day.sleepLogs.filter(s => s.isNap).reduce((a, b) => a + b.hours, 0);
    return { runKm, walkKm, totalKm: runKm + walkKm, steps, caloriesOut, caloriesIn, waterMl, protein, sleepHrs, napHrs };
  }, [day]);

  const last14 = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(date); d.setDate(d.getDate() - (13 - i));
    const iso = d.toISOString().slice(0, 10); const j = journal[iso];
    const run = j?.workouts.filter(w => w.type === "run" || w.type === "hike").reduce((a, b) => a + b.km, 0) ?? 0;
    const walk = j?.workouts.filter(w => w.type === "walk" || w.type === "recovery").reduce((a, b) => a + b.km, 0) ?? 0;
    return { day: d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }), date: iso, run: Number(run.toFixed(1)), walk: Number(walk.toFixed(1)), total: Number((run + walk).toFixed(1)) };
  }), [journal, date]);

  const weekStats = useMemo(() => {
    const last7 = last14.slice(-7);
    return {
      totalDistance: last7.reduce((a, b) => a + b.total, 0),
      running: last7.reduce((a, b) => a + b.run, 0),
      walking: last7.reduce((a, b) => a + b.walk, 0),
      calories: Object.values(journal).filter(j => last7.some(d => d.date === j.date)).reduce((a, j) => a + j.workouts.reduce((s, w) => s + w.calories, 0), 0),
      activeDays: last7.filter(d => d.total > 0).length,
    };
  }, [last14, journal]);

  const addWorkout = (w: Omit<Workout, "id" | "steps" | "pace" | "calories">) => {
    const workout: Workout = { ...w, id: uid(), steps: decodeSteps(w.type, w.km), pace: calcPace(w.duration, w.km), calories: calcCalories(w.type, w.km) };
    setJournal(j => ({ ...j, [date]: { ...day, workouts: [workout, ...day.workouts] } }));
    setShowAdd(null);
    setTimeout(() => triggerCoachNotif("workout"), 600);
  };
  const updateWorkout = (w: Workout) => {
    setJournal(j => ({ ...j, [date]: { ...day, workouts: day.workouts.map(x => x.id === w.id ? { ...w, steps: decodeSteps(w.type, w.km), pace: calcPace(w.duration, w.km), calories: calcCalories(w.type, w.km) } : x) } }));
    setEditingWorkout(null);
  };
  const deleteWorkout = (id: string) => { setJournal(j => ({ ...j, [date]: { ...day, workouts: day.workouts.filter(w => w.id !== id) } })); };

  const addExercise = (e: Omit<Exercise, "id" | "calories">) => {
    const ex: Exercise = { ...e, id: uid(), calories: calcExerciseCalories(e.name, e.reps, e.sets) };
    setJournal(j => ({ ...j, [date]: { ...day, exercises: [ex, ...day.exercises] } }));
    setShowAdd(null);
    setTimeout(() => triggerCoachNotif("exercise"), 600);
  };
  const deleteExercise = (id: string) => { setJournal(j => ({ ...j, [date]: { ...day, exercises: day.exercises.filter(e => e.id !== id) } })); };

  const addFood = (f: Omit<Food, "id">) => {
    setJournal(j => ({ ...j, [date]: { ...day, foods: [...day.foods, { ...f, id: uid() }] } }));
    setTimeout(() => triggerCoachNotif("food"), 600);
  };
  const deleteFood = (id: string) => { setJournal(j => ({ ...j, [date]: { ...day, foods: day.foods.filter(f => f.id !== id) } })); };

  const addWater = useCallback((amount: number) => {
    setJournal(j => {
      const d = j[date] ?? { date, workouts: [], exercises: [], foods: [], water: [], sleepLogs: [] };
      return { ...j, [date]: { ...d, water: [...d.water, { id: uid(), amount, time: timeNow() }] } };
    });
    setShowAdd(null);
    setWaterPop(true);
    setTimeout(() => setWaterPop(false), 1200);
    setTimeout(() => triggerCoachNotif("water"), 600);
  }, [date, triggerCoachNotif]);
  const deleteWater = (id: string) => { setJournal(j => ({ ...j, [date]: { ...day, water: day.water.filter(w => w.id !== id) } })); };

  const addSleep = (s: Omit<SleepLog, "id" | "hours">) => {
    const hours = calcSleepHours(s.bedTime, s.wakeTime);
    setJournal(j => ({ ...j, [date]: { ...day, sleepLogs: [...day.sleepLogs, { ...s, id: uid(), hours }] } }));
    setShowAdd(null);
    setTimeout(() => triggerCoachNotif("sleep"), 600);
  };
  const deleteSleep = (id: string) => { setJournal(j => ({ ...j, [date]: { ...day, sleepLogs: day.sleepLogs.filter(s => s.id !== id) } })); };

  const finishDay = () => {
    const ss = Math.min(100, (totals.steps / 10000) * 100) * 0.2;
    const ws = Math.min(100, (totals.waterMl / 2500) * 100) * 0.2;
    const as2 = Math.min(100, (totals.totalKm / 8) * 100) * 0.15;
    const es = Math.min(100, (day.exercises.length / 3) * 100) * 0.1;
    const ns = Math.min(100, (totals.protein / 100) * 80 + (totals.caloriesIn > 1600 && totals.caloriesIn < 2400 ? 20 : 10)) * 0.15;
    const sls = Math.min(100, (totals.sleepHrs / 7) * 100) * 0.2;
    setJournal(j => ({ ...j, [date]: { ...day, finished: true, rating: Math.round(ss + ws + as2 + es + ns + sls) } }));
    setShowFinish(false);
  };

  const macroData = useMemo(() => {
    const p = day.foods.reduce((a, b) => a + b.protein * 4, 0);
    const c = day.foods.reduce((a, b) => a + b.carbs * 4, 0);
    const f = day.foods.reduce((a, b) => a + b.fat * 9, 0);
    const t = p + c + f || 1;
    return [
      { name: "Protein", value: Math.round((p / t) * 100), color: "#22d3ee" },
      { name: "Carbs", value: Math.round((c / t) * 100), color: "#4ade80" },
      { name: "Fat", value: Math.round((f / t) * 100), color: "#f97316" },
    ];
  }, [day]);

  const waterPercent = Math.min(100, (totals.waterMl / 2500) * 100);
  const bottleFills = Math.floor(totals.waterMl / 1500);
  const bottleRemainder = totals.waterMl % 1500;

  return (
    <div className="min-h-screen bg-[#030712] text-white selection:bg-emerald-500/30">
      {/* Animated background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.12),_transparent_60%),radial-gradient(ellipse_at_bottom_right,_rgba(6,182,212,0.1),_transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.08),_transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)`, backgroundSize: "64px 64px" }} />
        <div className="absolute top-[20%] left-[10%] h-64 w-64 rounded-full bg-emerald-500/5 blur-[80px] anim-float-slow" />
        <div className="absolute top-[50%] right-[15%] h-48 w-48 rounded-full bg-cyan-500/5 blur-[60px] anim-float-slow delay-1000" />
        <div className="absolute bottom-[20%] left-[40%] h-56 w-56 rounded-full bg-violet-500/4 blur-[70px] anim-float delay-500" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-3 sm:px-4 py-4 sm:py-6 lg:px-8 lg:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-3 anim-fade-down">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-emerald-500/20 blur-xl anim-breathe" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-900/30 anim-pulse-glow">
                <Activity className="h-6 w-6 text-black" />
              </div>
            </div>
            <div>
              <h1 className="text-[18px] sm:text-[22px] font-semibold tracking-tight bg-gradient-to-r from-white via-emerald-200 to-cyan-200 bg-clip-text text-transparent anim-gradient-shift" style={{ backgroundSize: "200% 200%" }}>AlokeshFitness</h1>
              <p className="text-[10px] sm:text-xs text-zinc-400 -mt-1">Your Personal Health Journal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 backdrop-blur transition-all hover:border-white/20 hover:bg-white/[0.05]">
              <Calendar className="h-4 w-4 text-zinc-400" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-sm outline-none [color-scheme:dark]" />
            </div>
            <button onClick={() => setDate(todayISO())} className="btn-ripple rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:bg-white/10 hover:border-white/20 active:scale-95">Today</button>
            {!day.finished && (
              <button onClick={() => setShowFinish(true)} className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-2 text-sm font-medium shadow-lg shadow-emerald-900/25 transition hover:shadow-emerald-900/40 active:scale-95 anim-pulse-glow">
                <span className="relative z-10 flex items-center gap-1.5"><Check className="h-4 w-4" /> Finish Day</span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition group-hover:translate-x-full duration-700" />
              </button>
            )}
            {day.finished && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 anim-fade-scale">
                <Award className="h-4 w-4 anim-float" /> Day Complete • {day.rating}/100
              </div>
            )}
          </div>
        </div>

        {/* Today's Summary Bar — always visible */}
        <div className="mb-5 anim-fade-up delay-75">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 sm:px-4 py-2 backdrop-blur">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Today</span>
              <span className="text-[14px] sm:text-[15px] font-semibold text-emerald-300">{totals.totalKm.toFixed(1)} km</span>
              <span className="text-zinc-700">|</span>
              <span className="text-[12px] sm:text-[13px] text-zinc-400">{totals.steps.toLocaleString()} steps</span>
              <span className="text-zinc-700">|</span>
              <span className="text-[12px] sm:text-[13px] text-zinc-400">{totals.caloriesIn} cal</span>
              <span className="text-zinc-700">|</span>
              <span className="text-[13px] text-zinc-400">{(totals.waterMl/1000).toFixed(1)}L water</span>
            </div>
            <button onClick={() => setShowStats(!showStats)} className={`rounded-xl border px-3 py-2.5 text-sm transition active:scale-95 ${showStats ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-300"}`}>
              {showStats ? "Hide Totals" : "Show Totals"}
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-5">
          {/* Main Chart */}
          <div className={`${showStats ? "col-span-12 xl:col-span-8" : "col-span-12"} anim-fade-up delay-100`}>
            <div className="relative overflow-hidden rounded-[28px] border border-emerald-900/30 bg-[#05130a]/70 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_20px_60px_-30px_rgba(16,185,129,0.5)] backdrop-blur-xl card-hover anim-shimmer">
              <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl anim-breathe" />
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-medium text-zinc-200">Activity Overview</h2>
                  <p className="text-xs text-zinc-500">Running vs Walking • Last 14 days</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#4ade80] shadow-[0_0_10px_rgba(74,222,128,0.5)] animate-pulse" /> Running (km)</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#22d3ee] shadow-[0_0_10px_rgba(34,211,238,0.5)] animate-pulse" /> Walking (km)</span>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer>
                  <AreaChart data={last14} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRun" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" stopOpacity={0.5} /><stop offset="100%" stopColor="#4ade80" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gWalk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={35} label={{ value: "Distance (km)", angle: -90, position: "insideLeft", fill: "#52525b", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#030712", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }} labelStyle={{ color: "#e4e4e7" }} itemStyle={{ color: "#a1a1aa", fontSize: 12 }} formatter={(v: any, n: any) => [`${v} km`, n === "run" ? "Running" : "Walking"]} />
                    <Area type="monotone" dataKey="run" stroke="#4ade80" strokeWidth={2.5} fill="url(#gRun)" dot={{ r: 3, strokeWidth: 2, fill: "#030712" }} activeDot={{ r: 5 }} animationDuration={1200} animationEasing="ease-out" />
                    <Area type="monotone" dataKey="walk" stroke="#22d3ee" strokeWidth={2.5} fill="url(#gWalk)" dot={{ r: 3, strokeWidth: 2, fill: "#030712" }} activeDot={{ r: 5 }} animationDuration={1500} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Stats — hidden by default */}
          {showStats && (
            <div className="col-span-12 xl:col-span-4 grid grid-cols-2 xl:grid-cols-1 gap-3 auto-rows-fr anim-fade-right">
              {[
                { label: "Total Distance", value: weekStats.totalDistance, unit: " km", icon: Footprints, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "anim-pulse-glow" },
                { label: "Running", value: weekStats.running, unit: " km", icon: Activity, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", glow: "" },
                { label: "Walking", value: weekStats.walking, unit: " km", icon: Watch, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", glow: "" },
                { label: "Calories Burned", value: weekStats.calories, unit: "", icon: Flame, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", glow: "" },
                { label: "Active Days", value: weekStats.activeDays, unit: "/7", icon: Calendar, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "" },
              ].map((s, i) => (
                <div key={s.label} className={`group relative overflow-hidden rounded-2xl border ${s.border} bg-[#0a0f0a]/70 p-4 backdrop-blur transition hover:bg-[#0f1a0f]/80 card-hover anim-shimmer`} style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{s.label}</p>
                      <p className={`mt-1.5 text-[22px] font-semibold leading-none ${s.color}`}>
                        <AnimatedNumber value={s.value} />{s.unit}
                      </p>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} ring-1 ring-inset ring-white/5 transition-all group-hover:scale-110 group-hover:rotate-6 duration-300 ${s.glow}`}>
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Log */}
          <div className="col-span-12 anim-fade-up delay-300">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              {[
                { k: "workout", label: "Log Run/Walk", icon: Activity, desc: `${totals.totalKm.toFixed(1)} km`, color: "from-emerald-600/20 to-green-600/20 hover:from-emerald-600/30 hover:to-green-600/30 border-emerald-500/20" },
                { k: "exercise", label: "Exercises", icon: Dumbbell, desc: `${day.exercises.length} logged`, color: "from-violet-600/20 to-purple-600/20 hover:from-violet-600/30 hover:to-purple-600/30 border-violet-500/20" },
                { k: "food", label: "Add Food", icon: Utensils, desc: `${totals.caloriesIn} kcal`, color: "from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/30 hover:to-blue-600/30 border-cyan-500/20" },
                { k: "water", label: "Water", icon: Droplets, desc: `${(totals.waterMl/1000).toFixed(1)}L / 2.5L`, color: "from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 border-blue-500/20" },
                { k: "sleep", label: "Sleep", icon: Moon, desc: `${totals.sleepHrs > 0 ? totals.sleepHrs.toFixed(1) + "h" : "Log sleep"}`, color: "from-indigo-600/20 to-blue-600/20 hover:from-indigo-600/30 hover:to-blue-600/30 border-indigo-500/20" },
                { k: "summary", label: "Score", icon: Target, desc: day.finished ? `${day.rating}/100` : "In progress", color: "from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 border-amber-500/20" },
              ].map((b, i) => (
                <button key={b.k} onClick={() => b.k !== "summary" && setShowAdd(b.k as any)} className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-b p-[1px] transition active:scale-95 ${b.color} particle-container anim-fade-up`} style={{ animationDelay: `${350 + i * 60}ms` }}>
                  <div className="p1 bg-emerald-400 bottom-1/2 left-1/2" />
                  <div className="p2 bg-cyan-400 bottom-1/2 left-1/2" />
                  <div className="p3 bg-white bottom-1/2 left-1/2" />
                  <div className="relative rounded-[15px] bg-[#050a05]/90 p-3 sm:p-4 backdrop-blur-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 transition-transform group-hover:scale-110 group-hover:rotate-12 duration-300">
                        <b.icon className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-zinc-300" />
                      </div>
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-600 transition-all group-hover:text-zinc-400 group-hover:rotate-90 duration-300" />
                    </div>
                    <div className="mt-2 sm:mt-3 text-left">
                      <div className="text-[12px] sm:text-[13px] font-medium text-zinc-200">{b.label}</div>
                      <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">{b.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Workout History */}
          <div className="col-span-12 anim-fade-up delay-400">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-medium text-zinc-200">Workout History</h3>
              <p className="text-xs text-zinc-500">Your recent sessions with pace, steps, calorie & step data.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
              {day.workouts.slice(0, 8).map((w, idx) => (
                <div key={w.id} className="group relative overflow-hidden rounded-[20px] border border-white/5 bg-[#07110a]/70 p-3 sm:p-4 backdrop-blur-xl transition-all hover:border-emerald-500/20 hover:bg-[#0a170e]/80 card-hover anim-slide-up" style={{ animationDelay: `${450 + idx * 100}ms` }}>
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl transition-all duration-500 group-hover:bg-emerald-500/10 group-hover:scale-125" />
                  <div className="relative">
                    <div className="flex items-start justify-between">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${w.type === "run" || w.type === "hike" ? "bg-emerald-500/15 text-emerald-400" : "bg-cyan-500/15 text-cyan-400"} ring-1 ring-inset ring-white/5 transition-all group-hover:scale-110 group-hover:rotate-6 duration-300`}>
                        {w.type === "run" || w.type === "hike" ? <Activity className="h-4.5 w-4.5" /> : <Watch className="h-4.5 w-4.5" />}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${w.type === "hike" ? "bg-orange-500/10 text-orange-300 ring-orange-500/20" : w.type === "run" ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" : "bg-cyan-500/10 text-cyan-300 ring-cyan-500/20"}`}>{w.title}</span>
                        <button onClick={() => setEditingWorkout(w)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-emerald-400 transition-all duration-200 hover:rotate-12"><Edit2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[28px] font-semibold leading-none tracking-tight text-white">{fmt(w.km, 1)}</span>
                        <span className="text-sm text-zinc-500">km</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">{new Date(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} • {w.time}</div>
                    </div>
                    <div className="mt-3.5 grid grid-cols-2 gap-2">
                      {[
                        { label: "Pace", value: w.pace },
                        { label: "Duration", value: `${Math.floor(w.duration/60)}h ${w.duration%60}m` },
                        { label: "Calories", value: w.calories.toString() },
                        { label: "Steps", value: w.steps.toLocaleString() },
                      ].map((m) => (
                        <div key={m.label} className="rounded-lg bg-black/30 px-2.5 py-2 ring-1 ring-white/5 transition-all hover:bg-black/50 hover:ring-white/10">
                          <div className="text-[10px] text-zinc-500">{m.label}</div>
                          <div className={`text-[13px] font-medium ${m.label === "Pace" || m.label === "Calories" ? "text-orange-300" : "text-cyan-300"}`}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {day.workouts.length === 0 && (
                <div className="col-span-full rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center anim-fade-scale">
                  <Activity className="mx-auto h-8 w-8 text-zinc-700 mb-2 anim-float" />
                  <p className="text-sm text-zinc-500">No workouts logged yet. Add your first run or walk!</p>
                </div>
              )}
            </div>
          </div>

          {/* Exercises Section */}
          {day.exercises.length > 0 && (
            <div className="col-span-12 anim-fade-up delay-450">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-medium text-zinc-200 flex items-center gap-2"><Dumbbell className="h-4 w-4 text-violet-400" /> Exercises</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {day.exercises.map((ex, idx) => (
                  <div key={ex.id} className="group relative rounded-[16px] border border-white/5 bg-[#0a0a14]/70 p-3.5 backdrop-blur-xl transition-all hover:border-violet-500/20 card-hover anim-fade-up" style={{ animationDelay: `${idx * 60}ms` }}>
                    <div className="flex items-start justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400 ring-1 ring-inset ring-white/5">
                        <Dumbbell className="h-4 w-4" />
                      </div>
                      <button onClick={() => deleteExercise(ex.id)} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 transition"><Trash2 className="h-3 w-3" /></button>
                    </div>
                    <div className="mt-2.5">
                      <div className="text-[13px] font-medium text-zinc-200 truncate">{ex.name}</div>
                      <div className="text-[11px] text-zinc-500">{ex.time}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      <div className="rounded-md bg-black/30 px-1.5 py-1 text-center ring-1 ring-white/5">
                        <div className="text-[9px] text-zinc-500">Sets</div>
                        <div className="text-[13px] font-semibold text-violet-300">{ex.sets}</div>
                      </div>
                      <div className="rounded-md bg-black/30 px-1.5 py-1 text-center ring-1 ring-white/5">
                        <div className="text-[9px] text-zinc-500">Reps</div>
                        <div className="text-[13px] font-semibold text-violet-300">{ex.reps}</div>
                      </div>
                      <div className="rounded-md bg-black/30 px-1.5 py-1 text-center ring-1 ring-white/5">
                        <div className="text-[9px] text-zinc-500">Cal</div>
                        <div className="text-[13px] font-semibold text-orange-300">{ex.calories}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom analytics */}
          <div className="col-span-12 grid grid-cols-12 gap-5">
            {/* Water */}
            <div className="col-span-12 lg:col-span-3 anim-fade-up delay-500">
              <div className={`h-full rounded-[24px] border border-blue-900/30 bg-[#040c14]/70 p-5 backdrop-blur-xl card-hover water-wave transition-all ${waterPop ? "anim-pulse-glow-blue" : ""}`}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[14px] font-medium flex items-center gap-2"><Droplets className={`h-4 w-4 text-blue-400 ${waterPop ? "animate-bounce" : ""}`} /> Hydration</h4>
                  <span className="text-xs text-zinc-500">{bottleFills}× 1.5L</span>
                </div>
                <div className="flex gap-4">
                  <div className="relative">
                    <div className="relative h-[140px] w-[70px] anim-float-slow">
                      <svg viewBox="0 0 70 140" className="absolute inset-0">
                        <defs>
                          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#0ea5e9" /></linearGradient>
                          <clipPath id="bottleClip"><path d="M20 10 C20 5, 24 2, 30 2 L40 2 C46 2, 50 5, 50 10 L52 18 L52 38 C57 42, 60 48, 60 56 L60 118 C60 126, 54 132, 46 132 L24 132 C16 132, 10 126, 10 118 L10 56 C10 48, 13 42, 18 38 L18 18 Z" /></clipPath>
                        </defs>
                        <path d="M20 10 C20 5, 24 2, 30 2 L40 2 C46 2, 50 5, 50 10 L52 18 L52 38 C57 42, 60 48, 60 56 L60 118 C60 126, 54 132, 46 132 L24 132 C16 132, 10 126, 10 118 L10 56 C10 48, 13 42, 18 38 L18 18 Z" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                        <g clipPath="url(#bottleClip)">
                          <rect x="10" y={132 - (bottleRemainder/1500)*120} width="50" height="120" fill="url(#waterGrad)" opacity="0.9">
                            <animate attributeName="y" values={`${132 - (bottleRemainder/1500)*120};${130 - (bottleRemainder/1500)*120};${132 - (bottleRemainder/1500)*120}`} dur="3s" repeatCount="indefinite" />
                          </rect>
                        </g>
                      </svg>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-medium text-blue-300 bg-[#040c14] px-1 py-0.5 rounded">1.5L</div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[28px] font-semibold leading-none text-white"><AnimatedNumber value={totals.waterMl/1000} /><span className="text-[16px] text-zinc-500 ml-1">L</span></div>
                    <div className="mt-1 text-xs text-zinc-500">of 2.5L • {Math.round(waterPercent)}%</div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700 rounded-full" style={{ width: `${waterPercent}%` }} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-1">
                      {[150, 250, 500].map(a => (
                        <button key={a} onClick={() => addWater(a)} className="rounded-lg bg-white/5 py-1 text-[10px] hover:bg-white/10 transition ring-1 ring-white/5 active:scale-90">+{a}</button>
                      ))}
                    </div>
                    <button onClick={() => addWater(1500)} className="mt-1 w-full rounded-lg bg-blue-500/15 py-1 text-[10px] text-blue-300 hover:bg-blue-500/25 transition ring-1 ring-blue-500/20 active:scale-95">+ Full Bottle</button>
                    {/* Water logs with delete */}
                    <div className="mt-2 space-y-1 max-h-[60px] overflow-auto">
                      {day.water.map(w => (
                        <div key={w.id} className="flex items-center justify-between rounded-md bg-white/5 px-2 py-1 text-[10px]">
                          <span className="text-zinc-400">{w.amount}ml • {w.time}</span>
                          <button onClick={() => deleteWater(w.id)} className="text-zinc-600 hover:text-red-400 transition"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nutrition */}
            <div className="col-span-12 lg:col-span-3 anim-fade-up delay-600">
              <div className="h-full rounded-[24px] border border-white/5 bg-[#0a0f0a]/70 p-5 backdrop-blur-xl card-hover">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[14px] font-medium flex items-center gap-2"><Apple className="h-4 w-4 text-emerald-400 anim-float" /> Nutrition</h4>
                  <span className="text-xs text-zinc-500">{totals.caloriesIn} cal</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "Protein", v: day.foods.reduce((a,b)=>a+b.protein,0), t: 120, c: "#22d3ee" },
                    { label: "Carbs", v: day.foods.reduce((a,b)=>a+b.carbs,0), t: 250, c: "#4ade80" },
                    { label: "Fat", v: day.foods.reduce((a,b)=>a+b.fat,0), t: 70, c: "#f97316" },
                  ].map((m, i) => (
                    <div key={m.label} className="text-center anim-fade-scale" style={{ animationDelay: `${700 + i * 100}ms` }}>
                      <div className="relative mx-auto h-14 w-14">
                        <svg className="rotate-[-90deg]" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                          <circle cx="32" cy="32" r="24" fill="none" stroke={m.c} strokeWidth="5" strokeDasharray={`${2*Math.PI*24}`} strokeDashoffset={`${2*Math.PI*24*(1-Math.min(1,m.v/m.t))}`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 grid place-items-center"><span className="text-[12px] font-semibold">{m.v}</span></div>
                      </div>
                      <div className="mt-0.5 text-[10px] text-zinc-500">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 max-h-[120px] overflow-auto pr-1">
                  {day.foods.map(f => (
                    <div key={f.id} className="group flex items-center justify-between rounded-lg bg-black/20 px-2.5 py-1.5 ring-1 ring-white/5 transition-all hover:bg-black/30 hover:ring-white/10">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-5 w-5 grid place-items-center rounded-md ${f.meal==="breakfast"?"bg-amber-500/15 text-amber-300":f.meal==="lunch"?"bg-emerald-500/15 text-emerald-300":f.meal==="dinner"?"bg-violet-500/15 text-violet-300":"bg-cyan-500/15 text-cyan-300"}`}>
                          {f.meal==="breakfast"?<Sun className="h-2.5 w-2.5" />:f.meal==="lunch"?<Utensils className="h-2.5 w-2.5" />:f.meal==="dinner"?<Moon className="h-2.5 w-2.5" />:<Apple className="h-2.5 w-2.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[11px] text-zinc-200">{f.name}</div>
                          <div className="text-[9px] text-zinc-500">{f.time} • P{f.protein}g C{f.carbs}g F{f.fat}g</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="text-[11px] font-medium text-zinc-300">{f.calories}</div>
                        <button onClick={() => deleteFood(f.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-600 hover:text-red-400 transition"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                  {day.foods.length === 0 && <div className="py-4 text-center text-xs text-zinc-600">No meals logged</div>}
                </div>
              </div>
            </div>

            {/* Sleep */}
            <div className="col-span-12 lg:col-span-3 anim-fade-up delay-650">
              <div className="h-full rounded-[24px] border border-indigo-900/30 bg-[#080a14]/70 p-5 backdrop-blur-xl card-hover">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[14px] font-medium flex items-center gap-2"><Moon className="h-4 w-4 text-indigo-400" /> Sleep</h4>
                  <button onClick={() => setShowAdd("sleep")} className="rounded-lg bg-indigo-500/15 px-2 py-1 text-[10px] text-indigo-300 hover:bg-indigo-500/25 transition ring-1 ring-indigo-500/20">+ Log</button>
                </div>
                {day.sleepLogs.length > 0 ? (
                  <div className="space-y-2">
                    {day.sleepLogs.map(s => (
                      <div key={s.id} className="group flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/5">
                        <div className="flex items-center gap-2">
                          <div className={`h-7 w-7 grid place-items-center rounded-lg ${s.isNap ? "bg-amber-500/15 text-amber-300" : "bg-indigo-500/15 text-indigo-300"} ring-1 ring-inset ring-white/5`}>
                            {s.isNap ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                          </div>
                          <div>
                            <div className="text-[12px] font-medium text-zinc-200">{s.isNap ? "Nap" : "Night Sleep"}</div>
                            <div className="text-[10px] text-zinc-500">{s.bedTime} → {s.wakeTime}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-[16px] font-semibold text-indigo-300">{s.hours}h</div>
                          <button onClick={() => deleteSleep(s.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-600 hover:text-red-400 transition"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
                      <span className="text-[11px] text-zinc-500">Total sleep</span>
                      <span className="text-[13px] font-semibold text-white">{totals.sleepHrs.toFixed(1)}h {totals.napHrs > 0 ? `(+${totals.napHrs.toFixed(1)}h nap)` : ""}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Moon className="mx-auto h-8 w-8 text-zinc-700 mb-2 anim-float" />
                    <p className="text-xs text-zinc-500">No sleep logged yet</p>
                    <button onClick={() => setShowAdd("sleep")} className="mt-2 rounded-lg bg-indigo-500/15 px-3 py-1.5 text-[11px] text-indigo-300 hover:bg-indigo-500/25 transition ring-1 ring-indigo-500/20">Log your sleep</button>
                  </div>
                )}
              </div>
            </div>

            {/* Daily Balance */}
            <div className="col-span-12 lg:col-span-3 anim-fade-up delay-700">
              <div className="h-full rounded-[24px] border border-white/5 bg-[#0a0f0a]/70 p-5 backdrop-blur-xl card-hover">
                <h4 className="text-[14px] font-medium flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-violet-400" /> Energy Balance</h4>
                <div className="h-[120px]">
                  <ResponsiveContainer>
                    <BarChart data={[{ name: "Today", in: totals.caloriesIn, out: totals.caloriesOut + 1650 }]} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ background: "#030712", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      <Bar dataKey="in" fill="#22d3ee" radius={[6,6,0,0]} name="Consumed" animationDuration={1000} />
                      <Bar dataKey="out" fill="#4ade80" radius={[6,6,0,0]} name="Burned" animationDuration={1200} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { l: "Steps", v: totals.steps.toLocaleString(), i: Footprints, c: "text-cyan-400" },
                    { l: "Active", v: `${day.workouts.reduce((a,b)=>a+b.duration,0)}m`, i: Zap, c: "text-amber-400" },
                    { l: "Sleep", v: `${totals.sleepHrs > 0 ? totals.sleepHrs.toFixed(1) + "h" : "—"}`, i: Moon, c: "text-violet-400" },
                  ].map((x, idx) => (
                    <div key={x.l} className="rounded-xl bg-black/20 p-2 text-center ring-1 ring-white/5 transition-all hover:ring-white/10 hover:bg-black/30 anim-fade-up" style={{ animationDelay: `${800 + idx * 80}ms` }}>
                      <x.i className={`mx-auto h-4 w-4 ${x.c} mb-1`} />
                      <div className="text-[10px] text-zinc-500">{x.l}</div>
                      <div className="text-[13px] font-semibold text-white">{x.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Steps & Macros */}
          <div className="col-span-12 grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-8 anim-fade-up delay-800">
              <div className="rounded-[24px] border border-white/5 bg-[#050a05]/70 p-5 backdrop-blur-xl card-hover anim-shimmer">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[14px] font-medium">Weekly Steps Trend</h4>
                  <div className="text-xs text-zinc-500">Avg {Math.round(last14.reduce((a,b)=>a+b.total*1320,0)/14).toLocaleString()} steps/day</div>
                </div>
                <div className="h-[180px]">
                  <ResponsiveContainer>
                    <LineChart data={last14.map(d => ({ ...d, steps: Math.round(d.total * 1320) }))}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} width={40} />
                      <Tooltip contentStyle={{ background: "#030712", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      <Line type="monotone" dataKey="steps" stroke="#4ade80" strokeWidth={2.5} dot={false} animationDuration={1800} animationEasing="ease-out" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-4 anim-fade-up delay-900">
              <div className="rounded-[24px] border border-white/5 bg-[#050a05]/70 p-5 backdrop-blur-xl h-full card-hover">
                <h4 className="text-[14px] font-medium mb-3">Macro Split</h4>
                <div className="flex items-center gap-4">
                  <div className="h-[120px] w-[120px]">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={macroData} dataKey="value" innerRadius={38} outerRadius={55} paddingAngle={3} stroke="none" animationDuration={1200} animationEasing="ease-out">
                          {macroData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {macroData.map((m, i) => (
                      <div key={m.name} className="flex items-center gap-2 text-xs anim-fade-left" style={{ animationDelay: `${950 + i * 80}ms` }}>
                        <span className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: m.color }} />
                        <span className="text-zinc-400 w-14">{m.name}</span>
                        <span className="font-medium text-zinc-200">{m.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Import feedback banner */}
        {importMsg && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[55] max-w-md px-4 anim-fade-down`}>
            <div className={`rounded-2xl px-4 py-2.5 text-[12px] font-medium shadow-2xl ring-1 backdrop-blur-xl ${
              importMsg.type === "success"
                ? "bg-emerald-950/95 text-emerald-200 ring-emerald-500/30"
                : "bg-red-950/95 text-red-200 ring-red-500/30"
            }`}>{importMsg.text}</div>
          </div>
        )}

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleUpload} />

        {/* Import Confirmation Modal */}
        {showImport && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-xl anim-overlay">
            <div className="relative w-full max-w-sm overflow-hidden rounded-[24px] border border-amber-500/20 bg-[#120a08]/95 shadow-2xl anim-modal">
              <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl anim-breathe" />
              <div className="relative p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30 flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">Confirm Import</h3>
                    <p className="text-xs text-zinc-400 mt-1">BOKACHODA! This will REPLACE all your current data with the backup file.</p>
                  </div>
                </div>
                <div className="rounded-xl bg-black/30 p-3 ring-1 ring-white/5 text-[11px] text-zinc-300 mb-4">
                  <div className="flex justify-between py-1"><span className="text-zinc-500">Current days:</span><span className="font-semibold">{dayCount}</span></div>
                  <div className="border-t border-white/5 my-1" />
                  <p className="text-amber-300">⚠️ Your current {dayCount} days will be lost. Make sure you want this!</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowImport(false); }} className="flex-1 rounded-xl bg-white/5 py-2.5 text-[13px] text-zinc-300 hover:bg-white/10 transition ring-1 ring-white/10 active:scale-95">
                    Cancel
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-2.5 text-[13px] font-semibold text-black hover:from-amber-500 hover:to-orange-500 transition active:scale-95">
                    Yes, Replace
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 space-y-4 anim-fade-up delay-1000">
          {/* Data management bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 mr-1">Data:</span>
            <button onClick={handleDownload} className="btn-ripple flex items-center gap-1.5 rounded-lg bg-emerald-600/15 px-3 py-1.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/20 transition hover:bg-emerald-600/25 active:scale-95">
              <Download className="h-3.5 w-3.5" /> Download Backup
            </button>
            <button onClick={() => setShowImport(true)} className="btn-ripple flex items-center gap-1.5 rounded-lg bg-violet-600/15 px-3 py-1.5 text-[11px] font-medium text-violet-300 ring-1 ring-violet-500/20 transition hover:bg-violet-600/25 active:scale-95">
              <Upload className="h-3.5 w-3.5" /> Upload Backup
            </button>
            <div className="flex-1" />
            <button onClick={() => { localStorage.removeItem(STORAGE_KEY); location.reload(); }} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition active:scale-95">
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-600">
            <div>Step decoding: 1 km ≈ 1,320 steps • Data stored locally</div>
            <span>© AlokeshFitness</span>
          </div>
        </div>
      </div>

      {/* AI Coach */}
      <AICoach
        totals={totals}
        workoutCount={day.workouts.length}
        foodCount={day.foods.length}
        foods={day.foods.map(f => ({ name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, meal: f.meal }))}
        sleep={totals.sleepHrs}
        exerciseCount={day.exercises.length}
        isOpen={coachOpen}
        onToggle={() => setCoachOpen(!coachOpen)}
        notification={coachNotif}
        onAddWorkout={(w) => addWorkout({ ...w, heartRate: 0 })}
        onAddExercise={addExercise}
        onAddFood={addFood}
        onAddWater={addWater}
        onAddSleep={addSleep}
      />

      {/* Modals */}
      {(showAdd === "workout" || editingWorkout) && (
        <Modal title={editingWorkout ? "Edit Workout" : "Log Workout"} onClose={() => { setShowAdd(null); setEditingWorkout(null); }}>
          <WorkoutForm
            initial={editingWorkout}
            onSubmit={(data) => editingWorkout ? updateWorkout({ ...editingWorkout, ...data }) : addWorkout(data)}
            onDelete={editingWorkout ? () => { deleteWorkout(editingWorkout.id); setEditingWorkout(null); } : undefined}
          />
        </Modal>
      )}
      {showAdd === "exercise" && (
        <Modal title="Log Exercise" onClose={() => setShowAdd(null)}>
          <ExerciseForm onSubmit={addExercise} />
        </Modal>
      )}
      {showAdd === "food" && (
        <Modal title="Add Food" onClose={() => setShowAdd(null)}>
          <FoodForm onSubmit={addFood} onClose={() => setShowAdd(null)} />
        </Modal>
      )}
      {showAdd === "sleep" && (
        <Modal title="Log Sleep" onClose={() => setShowAdd(null)}>
          <SleepForm onSubmit={addSleep} />
        </Modal>
      )}
      {showAdd === "water" && (
        <Modal title="Log Water" onClose={() => setShowAdd(null)}>
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-500/5 p-3 ring-1 ring-blue-500/15 anim-fade-scale">
              <div className="flex items-center gap-2 text-sm text-blue-300"><Droplets className="h-4 w-4 anim-float" /> Your bottle: 1.5L</div>
              <p className="mt-1 text-xs text-zinc-400">Tap a preset or enter custom amount. Each log is timestamped.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[150, 250, 330, 500, 750, 1500].map((a, i) => (
                <button key={a} onClick={() => addWater(a)} className="group relative overflow-hidden rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10 active:scale-90 btn-ripple anim-fade-scale" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="text-[18px] font-semibold transition-transform group-hover:scale-110">{a}</div>
                  <div className="text-[11px] text-zinc-500">ml</div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 anim-fade-up delay-300">
              <input id="customWater" type="number" placeholder="Custom ml" className="flex-1 rounded-xl bg-black/40 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 focus:ring-blue-500/50 transition" />
              <button onClick={() => { const v = Number((document.getElementById('customWater') as HTMLInputElement).value); if (v>0) addWater(v); }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium hover:bg-blue-500 transition active:scale-95">Add</button>
            </div>
          </div>
        </Modal>
      )}
      {showFinish && (
        <Modal title="Finish Your Day" onClose={() => setShowFinish(false)}>
          <FinishDaySummary totals={totals} day={day} onConfirm={finishDay} />
        </Modal>
      )}
    </div>
  );
}

/* ---------- Components ---------- */

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/70 p-0 sm:p-4 backdrop-blur-xl anim-overlay">
      <div className="relative w-full sm:max-w-lg overflow-hidden sm:rounded-[24px] rounded-t-[24px] border border-white/10 bg-[#070e07]/95 shadow-2xl anim-modal max-h-[90vh] sm:max-h-[85vh] flex flex-col">
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl anim-breathe" />
        <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-cyan-500/8 blur-2xl anim-breathe delay-500" />
        <div className="relative flex items-center justify-between border-b border-white/5 px-4 sm:px-5 py-3 flex-shrink-0">
          <h3 className="text-[14px] sm:text-[15px] font-medium">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition hover:rotate-90 duration-300"><X className="h-4 w-4" /></button>
        </div>
        <div className="relative p-4 sm:p-5 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function WorkoutForm({ initial, onSubmit, onDelete }: { initial?: Workout | null; onSubmit: (w: Omit<Workout, "id" | "steps" | "pace" | "calories">) => void; onDelete?: () => void }) {
  const [type, setType] = useState<Workout["type"]>(initial?.type ?? "run");
  const [kmStr, setKmStr] = useState(initial?.km?.toString() ?? "");
  const [durStr, setDurStr] = useState(initial?.duration?.toString() ?? "");
  const [time, setTime] = useState(initial?.time ?? timeNow());
  const [title, setTitle] = useState(initial?.title ?? "Morning Run");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const km = parseFloat(kmStr) || 0;
  const duration = parseInt(durStr) || 0;
  const steps = decodeSteps(type, km);
  const pace = calcPace(duration, km);
  const calories = calcCalories(type, km);

  return (
    <form onSubmit={e => { e.preventDefault(); if (km <= 0) return; onSubmit({ type, km, duration, heartRate: 0, time, title, notes }); }} className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {(["run", "walk", "hike", "recovery"] as const).map((t, i) => (
          <button type="button" key={t} onClick={() => setType(t)} className={`rounded-xl px-3 py-2.5 text-xs capitalize ring-1 transition-all active:scale-90 anim-fade-scale ${type === t ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30 scale-105" : "bg-white/5 text-zinc-400 ring-white/10 hover:bg-white/10"}`} style={{ animationDelay: `${i * 50}ms` }}>{t}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Distance (km)">
          <input type="text" inputMode="decimal" placeholder="e.g. 2.5" value={kmStr} onChange={e => { const v = e.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setKmStr(v); }} className="w-full bg-transparent text-[22px] font-semibold outline-none" />
        </Field>
        <Field label="Duration (min)">
          <input type="text" inputMode="numeric" placeholder="e.g. 30" value={durStr} onChange={e => { const v = e.target.value; if (v === "" || /^\d*$/.test(v)) setDurStr(v); }} className="w-full bg-transparent text-[22px] font-semibold outline-none" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Steps", v: km > 0 ? steps.toLocaleString() : "—", s: "Auto-decoded" },
          { l: "Pace", v: km > 0 && duration > 0 ? pace : "—", s: "min/km" },
          { l: "Calories", v: km > 0 ? calories.toString() : "—", s: "est." },
        ].map((item, i) => (
          <div key={item.l} className="rounded-xl bg-black/30 p-3 ring-1 ring-white/5 transition-all hover:ring-emerald-500/20 anim-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="text-[11px] text-zinc-500">{item.l}</div>
            <div className="text-[18px] font-semibold text-emerald-300">{item.v}</div>
            <div className="text-[10px] text-zinc-600">{item.s}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title"><input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent outline-none" placeholder="Morning Run" /></Field>
        <Field label="Time"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-transparent outline-none [color-scheme:dark]" /></Field>
      </div>
      <Field label="Notes (optional)"><input value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-transparent outline-none" placeholder="How did it feel?" /></Field>
      <div className="flex items-center justify-between pt-2">
        {onDelete ? <button type="button" onClick={onDelete} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 transition active:scale-95"><Trash2 className="h-4 w-4" /> Delete</button> : <div />}
        <button type="submit" disabled={km <= 0} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-500 transition active:scale-95 btn-ripple disabled:opacity-40"><Save className="h-4 w-4" /> Save to Today</button>
      </div>
      <p className="text-[11px] leading-snug text-zinc-500">All logs merge into the same daily journal. Steps decoded at 1,320 steps/km.</p>
    </form>
  );
}

function ExerciseForm({ onSubmit }: { onSubmit: (e: Omit<Exercise, "id" | "calories">) => void }) {
  const [name, setName] = useState("Push-ups");
  const [reps, setReps] = useState(20);
  const [sets, setSets] = useState(3);
  const [duration, setDuration] = useState(30);
  const [time, setTime] = useState(timeNow());
  const [notes, setNotes] = useState("");
  const presets = ["Push-ups", "Pull-ups", "Squats", "Jaw Exercise", "Plank", "Jumping Jacks", "Burpees", "Sit-ups", "Lunges", "Arm Circles"];
  const estCal = calcExerciseCalories(name, reps, sets);

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, reps, sets, duration, time, notes }); }} className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((pr, i) => (
          <button key={pr} type="button" onClick={() => setName(pr)} className={`rounded-full px-3 py-1.5 text-[11px] ring-1 transition active:scale-90 anim-fade-scale ${name === pr ? "bg-violet-500/15 text-violet-200 ring-violet-500/30" : "bg-white/5 text-zinc-400 ring-white/10 hover:bg-white/10"}`} style={{ animationDelay: `${i * 30}ms` }}>{pr}</button>
        ))}
      </div>
      <Field label="Exercise Name"><input value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent outline-none" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Sets"><input type="number" value={sets} onChange={e => setSets(Number(e.target.value))} className="w-full bg-transparent text-[20px] font-semibold outline-none" /></Field>
        <Field label="Reps"><input type="number" value={reps} onChange={e => setReps(Number(e.target.value))} className="w-full bg-transparent text-[20px] font-semibold outline-none" /></Field>
        <Field label="Sec/Set"><input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full bg-transparent text-[20px] font-semibold outline-none" /></Field>
      </div>
      <div className="rounded-xl bg-violet-500/10 p-3 ring-1 ring-violet-500/20">
        <div className="text-[11px] text-violet-400">Estimated calories</div>
        <div className="text-[22px] font-semibold text-violet-300">{estCal}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Time"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-transparent outline-none [color-scheme:dark]" /></Field>
        <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-transparent outline-none" placeholder="Optional" /></Field>
      </div>
      <button type="submit" className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-black hover:bg-violet-500 transition active:scale-95 btn-ripple">Add Exercise</button>
    </form>
  );
}

function SleepForm({ onSubmit }: { onSubmit: (s: Omit<SleepLog, "id" | "hours">) => void }) {
  const [bedTime, setBedTime] = useState("22:00");
  const [wakeTime, setWakeTime] = useState("06:00");
  const [isNap, setIsNap] = useState(false);
  const hours = calcSleepHours(bedTime, wakeTime);

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ bedTime, wakeTime, isNap }); }} className="space-y-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setIsNap(false)} className={`flex-1 rounded-xl py-2.5 text-sm ring-1 transition ${!isNap ? "bg-indigo-500/15 text-indigo-200 ring-indigo-500/30" : "bg-white/5 text-zinc-400 ring-white/10"}`}>
          <Moon className="mx-auto h-4 w-4 mb-1" /> Night Sleep
        </button>
        <button type="button" onClick={() => setIsNap(true)} className={`flex-1 rounded-xl py-2.5 text-sm ring-1 transition ${isNap ? "bg-amber-500/15 text-amber-200 ring-amber-500/30" : "bg-white/5 text-zinc-400 ring-white/10"}`}>
          <Sun className="mx-auto h-4 w-4 mb-1" /> Nap
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={isNap ? "Nap Start" : "Bed Time"}><input type="time" value={bedTime} onChange={e => setBedTime(e.target.value)} className="w-full bg-transparent text-[18px] font-semibold outline-none [color-scheme:dark]" /></Field>
        <Field label={isNap ? "Wake Up" : "Wake Time"}><input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} className="w-full bg-transparent text-[18px] font-semibold outline-none [color-scheme:dark]" /></Field>
      </div>
      <div className="rounded-xl bg-indigo-500/10 p-4 ring-1 ring-indigo-500/20 text-center">
        <div className="text-[11px] text-indigo-400">Total sleep</div>
        <div className="text-[36px] font-semibold text-indigo-300">{hours}h</div>
      </div>
      <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-black hover:bg-indigo-500 transition active:scale-95 btn-ripple">Log Sleep</button>
    </form>
  );
}

function FoodForm({ onSubmit, onClose }: { onSubmit: (f: Omit<Food, "id">) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [meal, setMeal] = useState<Food["meal"]>("breakfast");
  const [cal, setCal] = useState(0);
  const [pro, setPro] = useState(0);
  const [carb, setCarb] = useState(0);
  const [fat, setFat] = useState(0);
  const [time, setTime] = useState(timeNow());
  const [tab, setTab] = useState<"breakfast"|"lunch"|"dinner"|"snack"|"custom">("breakfast");
  const [added, setAdded] = useState<{ name: string; calories: number; protein: number }[]>([]);
  const [showCustom, setShowCustom] = useState(false);

  const presetsByMeal = {
    breakfast: [
      { n: "Banana", c: 105, p: 1, cb: 27, f: 0, m: "breakfast" as const },
      { n: "Tea (less sugar)", c: 30, p: 1, cb: 7, f: 1, m: "breakfast" as const },
      { n: "2 Boiled Eggs", c: 156, p: 13, cb: 1, f: 11, m: "breakfast" as const },
      { n: "Omelette", c: 175, p: 12, cb: 2, f: 13, m: "breakfast" as const },
      { n: "Chana (1 bowl)", c: 210, p: 12, cb: 27, f: 5, m: "breakfast" as const },
      { n: "Dal (1 bowl)", c: 180, p: 9, cb: 30, f: 3, m: "breakfast" as const },
      { n: "Peanuts (handful)", c: 160, p: 7, cb: 5, f: 14, m: "breakfast" as const },
      { n: "Fruit (mixed)", c: 80, p: 1, cb: 20, f: 0, m: "breakfast" as const },
    ],
    lunch: [
      { n: "Rice (moderate)", c: 200, p: 4, cb: 45, f: 1, m: "lunch" as const },
      { n: "Rice (full plate)", c: 350, p: 7, cb: 78, f: 1, m: "lunch" as const },
      { n: "Dal (1 bowl)", c: 180, p: 9, cb: 30, f: 3, m: "lunch" as const },
      { n: "Sabji (1 bowl)", c: 120, p: 3, cb: 15, f: 5, m: "lunch" as const },
      { n: "Fish Curry", c: 220, p: 22, cb: 8, f: 12, m: "lunch" as const },
      { n: "Chicken Curry", c: 250, p: 25, cb: 10, f: 14, m: "lunch" as const },
      { n: "Egg Curry (2)", c: 210, p: 14, cb: 8, f: 13, m: "lunch" as const },
      { n: "Curd / Dahi", c: 60, p: 3, cb: 5, f: 3, m: "lunch" as const },
    ],
    dinner: [
      { n: "2 Roti", c: 240, p: 7, cb: 42, f: 5, m: "dinner" as const },
      { n: "3 Roti", c: 360, p: 11, cb: 63, f: 8, m: "dinner" as const },
      { n: "Sabji (1 bowl)", c: 120, p: 3, cb: 15, f: 5, m: "dinner" as const },
      { n: "Dal (1 bowl)", c: 180, p: 9, cb: 30, f: 3, m: "dinner" as const },
      { n: "Paneer Sabji", c: 265, p: 18, cb: 4, f: 21, m: "dinner" as const },
      { n: "Egg Bhurji (2)", c: 190, p: 13, cb: 3, f: 14, m: "dinner" as const },
    ],
    snack: [
      { n: "Peanuts (handful)", c: 160, p: 7, cb: 5, f: 14, m: "snack" as const },
      { n: "Banana", c: 105, p: 1, cb: 27, f: 0, m: "snack" as const },
      { n: "Tea (less sugar)", c: 30, p: 1, cb: 7, f: 1, m: "snack" as const },
      { n: "Curd / Dahi", c: 60, p: 3, cb: 5, f: 3, m: "snack" as const },
      { n: "Milk (1 glass)", c: 150, p: 8, cb: 12, f: 8, m: "snack" as const },
      { n: "Biscuits (4)", c: 140, p: 2, cb: 22, f: 5, m: "snack" as const },
    ],
    custom: [],
  };

  const quickAdd = (pr: { n: string; c: number; p: number; cb: number; f: number; m: Food["meal"] }) => {
    onSubmit({ name: pr.n, meal: pr.m, calories: pr.c, protein: pr.p, carbs: pr.cb, fat: pr.f, time });
    setAdded(prev => [...prev, { name: pr.n, calories: pr.c, protein: pr.p }]);
  };

  const addCustom = () => {
    if (!name.trim() || cal <= 0) return;
    onSubmit({ name, meal, calories: cal, protein: pro, carbs: carb, fat, time });
    setAdded(prev => [...prev, { name, calories: cal, protein: pro }]);
    setName(""); setCal(0); setPro(0); setCarb(0); setFat(0);
  };

  const totalAdded = added.reduce((a, b) => a + b.calories, 0);
  const totalProtein = added.reduce((a, b) => a + b.protein, 0);
  const presets = tab !== "custom" ? presetsByMeal[tab] : [];

  return (
    <div className="space-y-4">
      {added.length > 0 && (
        <div className="rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-500/20 anim-fade-scale">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-emerald-400">Added this session</span>
            <span className="text-xs text-emerald-300 font-medium">{totalAdded} cal • {totalProtein}g protein</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {added.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200 ring-1 ring-emerald-500/20 anim-fade-scale">
                ✓ {a.name} <span className="text-emerald-400">{a.calories}cal</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 rounded-xl bg-black/20 p-1 ring-1 ring-white/5">
        {(["breakfast","lunch","dinner","snack","custom"] as const).map(t => (
          <button key={t} type="button" onClick={() => { setTab(t); if (t === "custom") setShowCustom(true); else setShowCustom(false); }} className={`flex-1 rounded-lg px-1.5 py-1.5 text-[10px] capitalize transition ${tab === t ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30" : "text-zinc-500 hover:text-zinc-300"}`}>
            {t === "breakfast" ? "☀️" : t === "lunch" ? "🌤️" : t === "dinner" ? "🌙" : t === "snack" ? "🫐" : "✏️"} {t}
          </button>
        ))}
      </div>

      {tab !== "custom" && (
        <>
          <p className="text-[11px] text-zinc-500">Tap items to add them. Add as many as you want!</p>
          <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-auto pr-1">
            {presets.map((pr, i) => {
              const wasAdded = added.some(a => a.name === pr.n);
              return (
                <button key={pr.n + i} type="button" onClick={() => quickAdd(pr)} className={`rounded-xl px-3 py-2.5 text-left text-xs ring-1 transition active:scale-95 anim-fade-scale ${wasAdded ? "bg-emerald-500/10 ring-emerald-500/25" : "bg-white/5 ring-white/10 hover:bg-white/10"}`} style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-zinc-200">{pr.n}</div>
                    {wasAdded && <span className="text-emerald-400 text-[10px]">✓</span>}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{pr.c} cal • P{pr.p}g C{pr.cb}g F{pr.f}g</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {(tab === "custom" || showCustom) && (
        <div className="space-y-3 anim-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-zinc-300 font-medium">Custom food item</span>
            {tab !== "custom" && <button type="button" onClick={() => setShowCustom(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300">Hide</button>}
          </div>
          <Field label="Food Name"><input value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent outline-none" placeholder="e.g. Paratha, Biryani" /></Field>
          <div className="grid grid-cols-4 gap-2">
            {(["breakfast", "lunch", "dinner", "snack"] as const).map(m => (
              <button key={m} type="button" onClick={() => setMeal(m)} className={`rounded-xl px-2 py-1.5 text-[10px] capitalize ring-1 transition active:scale-90 ${meal === m ? "bg-cyan-500/15 text-cyan-200 ring-cyan-500/30" : "bg-white/5 text-zinc-400 ring-white/10"}`}>{m}</button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[{ l: "Calories", v: cal, s: setCal }, { l: "Protein", v: pro, s: setPro }, { l: "Carbs", v: carb, s: setCarb }, { l: "Fat", v: fat, s: setFat }].map(item => (
              <Field key={item.l} label={item.l}><input type="number" value={item.v || ""} onChange={e => item.s(Number(e.target.value))} className="w-full bg-transparent outline-none" placeholder="0" /></Field>
            ))}
          </div>
          <Field label="Time"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-transparent outline-none [color-scheme:dark]" /></Field>
          <button type="button" onClick={addCustom} disabled={!name.trim() || cal <= 0} className="w-full rounded-xl bg-cyan-600 py-2 text-sm font-medium text-black hover:bg-cyan-500 transition active:scale-95 btn-ripple disabled:opacity-40">
            + Add {name || "item"}
          </button>
        </div>
      )}

      {tab !== "custom" && !showCustom && (
        <button type="button" onClick={() => setShowCustom(true)} className="w-full rounded-xl border border-dashed border-white/10 py-2 text-[11px] text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition">
          + Add custom food with calories & macros
        </button>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <div className="text-[11px] text-zinc-500">{added.length} item{added.length !== 1 ? "s" : ""} added</div>
        <button type="button" onClick={onClose} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-500 transition active:scale-95 btn-ripple">
          Done ✓
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-xl bg-black/30 px-3 py-2 ring-1 ring-white/10 focus-within:ring-emerald-500/40 transition-all">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

function FinishDaySummary({ totals, day, onConfirm }: { totals: any; day: DayJournal; onConfirm: () => void }) {
  const stepsScore = Math.min(100, (totals.steps / 10000) * 100);
  const waterScore = Math.min(100, (totals.waterMl / 2500) * 100);
  const activityScore = Math.min(100, (totals.totalKm / 8) * 100);
  const exerciseScore = Math.min(100, (day.exercises.length / 3) * 100);
  const nutritionScore = Math.min(100, (totals.protein / 100) * 80 + (totals.caloriesIn > 1600 && totals.caloriesIn < 2400 ? 20 : 10));
  const sleepScore = Math.min(100, (totals.sleepHrs / 7) * 100);
  const rating = Math.round((stepsScore * 0.15 + waterScore * 0.15 + activityScore * 0.15 + exerciseScore * 0.1 + nutritionScore * 0.15 + sleepScore * 0.3));
  const suggestions: { icon: any; text: string; color: string }[] = [];
  if (totals.waterMl < 2000) suggestions.push({ icon: Droplets, text: "Increase hydration to 2.5L — you were short by " + Math.round((2500 - totals.waterMl) / 100) / 10 + "L", color: "text-blue-400" });
  if (totals.steps < 8000) suggestions.push({ icon: Footprints, text: "Add a 15-min evening walk to reach 10k steps", color: "text-cyan-400" });
  if (totals.protein < 55) suggestions.push({ icon: Beef, text: "Boost protein — add eggs, dal, or chicken/fish", color: "text-orange-400" });
  if (totals.totalKm < 3 && day.exercises.length === 0) suggestions.push({ icon: Activity, text: "Aim for at least some movement today", color: "text-emerald-400" });
  if (totals.sleepHrs < 6) suggestions.push({ icon: Moon, text: "Try to get 7-8 hours of sleep tonight", color: "text-indigo-400" });
  if (suggestions.length === 0) suggestions.push({ icon: Heart, text: "Excellent balance today! Maintain this routine.", color: "text-pink-400" });
  const grade = rating >= 85 ? "Excellent" : rating >= 70 ? "Good" : rating >= 55 ? "Fair" : "Needs Work";

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-transparent p-[1px] anim-fade-scale">
        <div className="rounded-[15px] bg-[#050a05] p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-zinc-500">Daily Health Score</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[42px] font-semibold leading-none tracking-tight text-emerald-300"><AnimatedNumber value={rating} duration={1200} /></span>
                <span className="text-zinc-500">/100</span>
              </div>
              <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 anim-fade-scale delay-300 ${grade === "Excellent" ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25" : grade === "Good" ? "bg-cyan-500/15 text-cyan-300 ring-cyan-500/25" : "bg-amber-500/15 text-amber-300 ring-amber-500/25"}`}><Award className="h-3 w-3" /> {grade}</div>
            </div>
            <div className="h-[80px] w-[120px]">
              <ResponsiveContainer>
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ name: "score", value: rating }]} startAngle={180} endAngle={0}>
                  <RadialBar dataKey="value" cornerRadius={10} fill="#4ade80" animationDuration={1500} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { l: "Steps", v: Math.round(stepsScore) },
              { l: "Water", v: Math.round(waterScore) },
              { l: "Move", v: Math.round(activityScore) },
              { l: "Exercise", v: Math.round(exerciseScore) },
              { l: "Fuel", v: Math.round(nutritionScore) },
              { l: "Sleep", v: Math.round(sleepScore) },
            ].map((s, i) => (
              <div key={s.l} className="rounded-lg bg-black/40 p-2 text-center ring-1 ring-white/5 anim-fade-up" style={{ animationDelay: `${400 + i * 80}ms` }}>
                <div className="text-[10px] text-zinc-500">{s.l}</div>
                <div className="text-[14px] font-semibold text-white"><AnimatedNumber value={s.v} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="anim-fade-up delay-500">
        <h4 className="mb-2 text-[13px] font-medium text-zinc-300">Today's Summary</h4>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          {[
            { k: "Distance", v: `${totals.totalKm.toFixed(1)} km (${totals.steps.toLocaleString()} steps)` },
            { k: "Workouts", v: `${day.workouts.length} sessions` },
            { k: "Exercises", v: `${day.exercises.length} logged` },
            { k: "Calories", v: `${totals.caloriesIn} in / ${totals.caloriesOut + 1650} out` },
            { k: "Hydration", v: `${(totals.waterMl/1000).toFixed(1)}L` },
            { k: "Sleep", v: `${totals.sleepHrs > 0 ? totals.sleepHrs.toFixed(1) + "h" : "—"}` },
          ].map(i => (
            <div key={i.k} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
              <span className="text-zinc-500">{i.k}</span>
              <span className="font-medium text-zinc-200">{i.v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="anim-fade-up delay-600">
        <h4 className="mb-2 text-[13px] font-medium text-zinc-300">Personalized Suggestions</h4>
        <div className="space-y-1.5">
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/5 anim-fade-left" style={{ animationDelay: `${700 + i * 80}ms` }}>
              <s.icon className={`mt-0.5 h-4 w-4 ${s.color} anim-float`} />
              <p className="text-[12px] leading-snug text-zinc-300">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onConfirm} className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3 text-sm font-medium shadow-lg shadow-emerald-900/20 transition hover:shadow-emerald-900/30 active:scale-95 anim-fade-up delay-800 btn-ripple">
        <span className="relative z-10 flex items-center justify-center gap-2"><Check className="h-4 w-4" /> Complete Day & Save Rating</span>
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 group-hover:translate-x-full transition duration-700" />
      </button>
      <p className="text-center text-[11px] text-zinc-600 anim-fade-up delay-900">You can still edit entries after finishing. Rating helps track weekly trends.</p>
    </div>
  );
}
