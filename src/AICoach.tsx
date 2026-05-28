import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Bot, ChevronDown, ChevronUp, Send, Sparkles, X, Check, Trash2 } from "lucide-react";
import { getMotivationSlang } from "./slang";

type Totals = {
  runKm: number; walkKm: number; totalKm: number; steps: number;
  caloriesOut: number; caloriesIn: number; waterMl: number; protein: number;
  sleepHrs: number; napHrs: number;
};

type FoodItem = {
  name: string; calories: number; protein: number; carbs: number; fat: number;
  meal: string;
};

type PendingAction = {
  id: string;
  type: "workout" | "food" | "water" | "sleep" | "exercise";
  summary: string;
  data: any;
};

type CoachMessage = {
  id: string;
  role: "coach" | "user" | "notification" | "pending";
  text: string;
  timestamp: string;
  type?: "success" | "warning" | "info" | "alert";
  pendingAction?: PendingAction;
};

const COACH_PRESETS = [
  "How's my day going?",
  "Rate my meals today",
  "Am I hydrated enough?",
  "What should I eat next?",
  "Review my workout",
  "Help me improve",
];

const uid = () => Math.random().toString(36).slice(2, 9);
const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function generateNotification(
  event: string, totals: Totals, _workoutCount: number, foods: FoodItem[]
): { text: string; type: "success" | "warning" | "info" | "alert" } | null {
  if (event === "workout") {
    if (totals.totalKm >= 5) return { text: `Bhai bhal korli! ${totals.totalKm.toFixed(1)}km (${totals.steps.toLocaleString()} steps)! ${getMotivationSlang("praise")} 🍌💪`, type: "success" };
    if (totals.totalKm > 0) {
      const waterNote = totals.waterMl < 1000 ? " — " + getMotivationSlang("lowWater").split(".")[0] : " keep going lancha!";
      return { text: `${totals.totalKm.toFixed(1)}km done! 👟${waterNote}`, type: "info" };
    }
    return null;
  }
  if (event === "exercise") {
    return { text: `Bhenchor! Exercise korli? Ei-rakamei koribo lagibo! ${getMotivationSlang("motivation")} 💪`, type: "success" };
  }
  if (event === "food") {
    const lastFood = foods[foods.length - 1];
    if (!lastFood) return null;
    if (totals.caloriesIn > 2200) return { text: `Boka! ${totals.caloriesIn} cal? ${getMotivationSlang("overEating")} 🍚`, type: "alert" };
    if (totals.protein < 30 && foods.length >= 2) {
      return { text: `${lastFood.name} khaali? Protein matro ${totals.protein}g! ${getMotivationSlang("lowProtein")} 🥚`, type: "warning" };
    }
    if (totals.protein >= 70 && totals.caloriesIn >= 1500) {
      return { text: `Bhai bhal! ${lastFood.name} ✅ — ${totals.caloriesIn} cal, ${totals.protein}g protein. ${getMotivationSlang("praise")} 🙌`, type: "success" };
    }
    return { text: `${lastFood.name} khaali? ${totals.caloriesIn} cal total. Baki khana-ta-o kha, protein bhal-nai ase! 🍽️`, type: "info" };
  }
  if (event === "water") {
    if (totals.waterMl >= 2500) {
      return { text: `Bhai bhal! 2.5L pani goal hit! ${getMotivationSlang("waterGoal")} 💧🎉`, type: "success" };
    }
    if (totals.waterMl >= 1500) {
      return { text: `Bhal progress! ${(totals.waterMl/1000).toFixed(1)}L. Aru ${((2500-totals.waterMl)/1000).toFixed(1)}L baki. ${getMotivationSlang("lowWater").split(".")[0]}`, type: "info" };
    }
    if (totals.waterMl > 0) {
      return { text: `${(totals.waterMl/1000).toFixed(1)}L? ${getMotivationSlang("lowWater")}`, type: "warning" };
    }
    return { text: getMotivationSlang("noWater"), type: "alert" };
  }
  if (event === "sleep") {
    return { text: `Bhai nind log korli! Good! ${totals.sleepHrs < 6 ? getMotivationSlang("noSleep") : getMotivationSlang("praise")}`, type: "success" };
  }
  return null;
}

/* ─── Natural Language Parser ─── */
function parseUserCommand(text: string): PendingAction | null {
  const t = text.toLowerCase();
  const runMatch = t.match(/(?:ran|run|jogged|jog)\s+(\d+(?:\.\d+)?)\s*(?:km|k)/);
  if (runMatch) {
    const km = parseFloat(runMatch[1]);
    const durMatch = t.match(/(\d+)\s*(?:min|minute)/);
    const duration = durMatch ? parseInt(durMatch[1]) : Math.round(km * 6);
    return { id: uid(), type: "workout", summary: `Run — ${km}km, ~${duration}min`, data: { type: "run" as const, km, duration, title: "Run", time: timeNow(), notes: "" } };
  }
  const walkMatch = t.match(/(?:walked|walk)\s+(\d+(?:\.\d+)?)\s*(?:km|k)/);
  if (walkMatch) {
    const km = parseFloat(walkMatch[1]);
    const durMatch = t.match(/(\d+)\s*(?:min|minute)/);
    const duration = durMatch ? parseInt(durMatch[1]) : Math.round(km * 12);
    return { id: uid(), type: "workout", summary: `Walk — ${km}km, ~${duration}min`, data: { type: "walk" as const, km, duration, title: "Walk", time: timeNow(), notes: "" } };
  }
  const exMatch = t.match(/(?:did\s+)?(\d+)\s*(?:push[\s-]?ups?|pushups)/);
  if (exMatch) {
    const reps = parseInt(exMatch[1]);
    const setsMatch = t.match(/(\d+)\s*(?:sets?)/);
    const sets = setsMatch ? parseInt(setsMatch[1]) : 1;
    return { id: uid(), type: "exercise", summary: `Push-ups — ${sets} sets × ${reps} reps`, data: { name: "Push-ups", reps, sets, duration: 30, time: timeNow(), notes: "" } };
  }
  const squatMatch = t.match(/(?:did\s+)?(\d+)\s*(?:squats?)/);
  if (squatMatch) {
    const reps = parseInt(squatMatch[1]);
    const setsMatch = t.match(/(\d+)\s*(?:sets?)/);
    const sets = setsMatch ? parseInt(setsMatch[1]) : 1;
    return { id: uid(), type: "exercise", summary: `Squats — ${sets} sets × ${reps} reps`, data: { name: "Squats", reps, sets, duration: 30, time: timeNow(), notes: "" } };
  }
  const plankMatch = t.match(/(?:did\s+)?plank\s+(?:for\s+)?(\d+)\s*(?:sec|seconds?)/);
  if (plankMatch) {
    const sec = parseInt(plankMatch[1]);
    return { id: uid(), type: "exercise", summary: `Plank — ${sec} seconds`, data: { name: "Plank", reps: 1, sets: 1, duration: sec, time: timeNow(), notes: "" } };
  }
  const waterMatch = t.match(/(?:drank|had|consumed)\s+(\d+(?:\.\d+)?)\s*(?:ml|mL)\s*(?:of\s+)?(?:water|paani|pani)/);
  if (waterMatch) return { id: uid(), type: "water", summary: `Water — ${waterMatch[1]}ml`, data: { amount: parseFloat(waterMatch[1]) } };
  const glassMatch = t.match(/(?:drank|had)\s+(\d+)\s*(?:glass|glasses)\s*(?:of\s+)?(?:water|paani|pani)/);
  if (glassMatch) return { id: uid(), type: "water", summary: `Water — ${glassMatch[1]} glass${parseInt(glassMatch[1])>1?"es":""} (~${parseInt(glassMatch[1])*250}ml)`, data: { amount: parseInt(glassMatch[1]) * 250 } };
  const foodMatch = t.match(/(?:ate|had|eat|eating)\s+(.+)/);
  if (foodMatch) {
    const foodText = foodMatch[1].trim();
    const knownFoods: Record<string, { cal: number; p: number; cb: number; f: number; meal: string }> = {
      "banana": { cal: 105, p: 1, cb: 27, f: 0, meal: "breakfast" }, "egg": { cal: 78, p: 6, cb: 1, f: 5, meal: "breakfast" },
      "eggs": { cal: 156, p: 13, cb: 1, f: 11, meal: "breakfast" }, "tea": { cal: 30, p: 1, cb: 7, f: 1, meal: "breakfast" },
      "chai": { cal: 30, p: 1, cb: 7, f: 1, meal: "breakfast" }, "chana": { cal: 210, p: 12, cb: 27, f: 5, meal: "breakfast" },
      "dal": { cal: 180, p: 9, cb: 30, f: 3, meal: "lunch" }, "rice": { cal: 200, p: 4, cb: 45, f: 1, meal: "lunch" },
      "sabji": { cal: 120, p: 3, cb: 15, f: 5, meal: "lunch" }, "fish": { cal: 220, p: 22, cb: 8, f: 12, meal: "lunch" },
      "chicken": { cal: 250, p: 25, cb: 10, f: 14, meal: "lunch" }, "roti": { cal: 120, p: 3, cb: 21, f: 2, meal: "dinner" },
      "peanuts": { cal: 160, p: 7, cb: 5, f: 14, meal: "snack" }, "curd": { cal: 60, p: 3, cb: 5, f: 3, meal: "snack" },
      "dahi": { cal: 60, p: 3, cb: 5, f: 3, meal: "snack" }, "milk": { cal: 150, p: 8, cb: 12, f: 8, meal: "snack" },
    };
    const foundFoods: any[] = [];
    let totalCal = 0, totalP = 0;
    for (const [key, data] of Object.entries(knownFoods)) {
      if (foodText.includes(key)) { foundFoods.push({ name: key.charAt(0).toUpperCase() + key.slice(1), ...data }); totalCal += data.cal; totalP += data.p; }
    }
    if (foundFoods.length > 0) return { id: uid(), type: "food", summary: `${foundFoods.map(f=>f.name).join(" + ")} — ${totalCal} cal, ${totalP}g protein`, data: foundFoods.map(f => ({ name: f.name, meal: f.meal, calories: f.cal, protein: f.p, carbs: f.cb, fat: f.f, time: timeNow() })) };
  }
  const sleepMatch = t.match(/(?:slept|sleep)\s+(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:pm|am)?\s+(?:to|until|till)\s+(\d{1,2})(?::(\d{2}))?\s*(?:pm|am)?/);
  if (sleepMatch) {
    let bh = parseInt(sleepMatch[1]), bm = sleepMatch[2] ? parseInt(sleepMatch[2]) : 0, wh = parseInt(sleepMatch[3]), wm = sleepMatch[4] ? parseInt(sleepMatch[4]) : 0;
    if (t.includes("pm") && bh < 12) bh += 12;
    if (t.includes("am") && wh < 12 && wh < bh) wh += 12;
    const bedTime = `${bh.toString().padStart(2,"0")}:${bm.toString().padStart(2,"0")}`, wakeTime = `${wh.toString().padStart(2,"0")}:${wm.toString().padStart(2,"0")}`;
    return { id: uid(), type: "sleep", summary: `${t.includes("nap")?"Nap":"Sleep"} — ${bedTime} → ${wakeTime}`, data: { bedTime, wakeTime, isNap: t.includes("nap") } };
  }
  return null;
}

function generateCoachResponse(
  query: string, totals: Totals, workoutCount: number, foods: FoodItem[], sleep?: number, exerciseCount?: number
): string {
  const q = query.toLowerCase();
  const hr = new Date().getHours();

  if (q.includes("water") || q.includes("hydrat") || q.includes("drink") || q.includes("paani") || q.includes("pani")) {
    const liters = (totals.waterMl / 1000).toFixed(1);
    if (totals.waterMl >= 2500) return `Bhai bhal! ${liters}L pani! Tor kidney-ta khosi hobo! ${getMotivationSlang("praise")} 💧`;
    if (totals.waterMl >= 1500) return `${liters}L progress — bhal! Aru ${((2500-totals.waterMl)/1000).toFixed(1)}L baki. ${getMotivationSlang("lowWater").split(".")[0]}...`;
    if (totals.waterMl > 0) return `Only ${liters}L? ${getMotivationSlang("lowWater")}`;
    return `${getMotivationSlang("noWater")}`;
  }

  if (q.includes("protein") || q.includes("muscle") || q.includes("macro")) {
    const p = totals.protein, tc = foods.reduce((a,b)=>a+b.carbs,0), tf = foods.reduce((a,b)=>a+b.fat,0);
    let r = `Tor macros aji:\n🥩 Protein: ${p}g${p>=70?" — solid!":p>=45?" — decent, push higher":" — boka too low!"}\n🌾 Carbs: ${tc}g${tc>300?" — careful rice beshi!":" — okay"}\n🥑 Fat: ${tf}g\n\n`;
    if (p < 50) r += `Protein baras: eggs (12g/2), chicken/fish (22-25g), dal (9g/bowl).`;
    else if (p >= 70) r += `Good! Keep eggs+dal+chicken/fish regularly.`;
    else r += `Okay zone, but for ${totals.totalKm.toFixed(1)}km push for 70g+.`;
    return r;
  }

  if (q.includes("meal") || q.includes("food") || q.includes("eat") || q.includes("nutrition") || q.includes("calor") || q.includes("khaana") || q.includes("khana")) {
    if (foods.length === 0) {
      if (hr < 8) return `Morning! Breakfast nai? After run, have banana+tea+eggs (or dal/chana if no eggs).`;
      if (hr < 13) return `${hr>12?"Afternoon":"Late morning"} aru no food? Don't skip breakfast lancha!`;
      return `No meals logged today? Bro log kor — even simple dal roti. Tap "Add Food"!`;
    }
    let r = `Tor aaji khana 🍽️\n\n`;
    const meals = { breakfast: foods.filter(f=>f.meal==="breakfast"), lunch: foods.filter(f=>f.meal==="lunch"), dinner: foods.filter(f=>f.meal==="dinner"), snack: foods.filter(f=>f.meal==="snack") };
    if (meals.breakfast.length>0) { const bc=meals.breakfast.reduce((a,b)=>a+b.calories,0), bp=meals.breakfast.reduce((a,b)=>a+b.protein,0); r += `☀️ Breakfast: ${meals.breakfast.map(f=>f.name).join(", ")} — ${bc} cal, ${bp}g protein\n`; }
    if (meals.lunch.length>0) { const lc=meals.lunch.reduce((a,b)=>a+b.calories,0), lp=meals.lunch.reduce((a,b)=>a+b.protein,0); r += `🌤️ Lunch: ${meals.lunch.map(f=>f.name).join(", ")} — ${lc} cal, ${lp}g protein\n`; }
    if (meals.dinner.length>0) { const dc=meals.dinner.reduce((a,b)=>a+b.calories,0); r += `🌙 Dinner: ${meals.dinner.map(f=>f.name).join(", ")} — ${dc} cal\n`; }
    r += `\n📊 Total: ${totals.caloriesIn} cal | ${totals.protein}g protein\n`;
    if (totals.caloriesIn > 2200) r += `\n⚠️ Over 2200 cal — rice kom kha! ${getMotivationSlang("overEating").split(".")[0]}`;
    else if (totals.caloriesIn > 1800) r += `\n✅ Calories balanced.`;
    else if (totals.caloriesIn > 0) r += `\n🔸 A bit under — next meal-ta bhal-nai kha!`;
    return r;
  }

  if (q.includes("what should i eat") || q.includes("suggest") || q.includes("kya khaun")) {
    const bl = foods.some(f=>f.meal==="breakfast"), ll = foods.some(f=>f.meal==="lunch"), dl = foods.some(f=>f.meal==="dinner");
    if (!bl && hr < 10) return `Breakfast (after run):\n🍌 Banana — 105 cal\n🍵 Tea (less sugar) — 30 cal\n🥚 2 Boiled Eggs — 156 cal, 12.6g protein\nNo eggs? Chana/Dal (180-210 cal, 9-12g), Peanuts (160 cal, 7g)\nTotal: ~290-350 cal, 14-20g protein.`;
    if (!ll && hr < 16) return `Lunch:\n🍚 Rice (moderate!)\n🫘 Dal — 180 cal, 9g protein\n🥘 Sabji — 120 cal\n${totals.protein<40?"🐟 Fish/Chicken — 22-25g protein!":""}\nMore dal & sabji, less rice.`;
    if (!dl) return `Dinner:\n🫓 2 Roti — 240 cal, 7g protein\n🥘 Sabji — 120 cal\n🫘 Dal — 180 cal, 9g protein\nEat by 8:30 PM, sleep by 10 PM!`;
    return `All meals done! If hungry, curd (60 cal) or fruit. Avoid oily/junk now.`;
  }

  if (q.includes("workout") || q.includes("exercise") || q.includes("run") || q.includes("walk") || q.includes("review")) {
    if (totals.totalKm >= 8) return `Bhai ${totals.totalKm.toFixed(1)}km? INSANE! 🔥 ${totals.steps.toLocaleString()} steps. Drink water, eat protein, sleep by 10 PM!`;
    if (totals.totalKm >= 4) return `Solid! ${totals.totalKm.toFixed(1)}km (${totals.steps.toLocaleString()} steps). Try intervals: 1 min fast / 2 min slow.`;
    if (totals.totalKm > 0) return `${totals.totalKm.toFixed(1)}km done! 👟 Add post-dinner walk for digestion.`;
    if (hr < 8) return `Morning run nai yet? Try before 7 AM while it's cool.`;
    return `No workout logged 😕 Even 15-min walk kor — keeps habit alive.`;
  }

  if (q.includes("sleep") || q.includes("rest") || q.includes("tired") || q.includes("neend")) {
    if (sleep && sleep >= 7) return `${sleep.toFixed(1)} hours — bhal! 😴 With ${totals.totalKm.toFixed(1)}km today, 7+ hours is perfect.`;
    if (sleep) return `Only ${sleep.toFixed(1)} hours? ${getMotivationSlang("noSleep").split(".")[0]}!`;
    return `Sleep is #1 recovery. 7-8 hours helps muscles recover. Set alarm for 9:30 PM!`;
  }

  if (q.includes("improve") || q.includes("better") || q.includes("suggest") || q.includes("help") || q.includes("tip")) {
    const tips: string[] = [];
    if (totals.waterMl < 2000) tips.push("💧 Drink more — at " + (totals.waterMl/1000).toFixed(1) + "L, need 2.5L");
    if (totals.steps < 8000) tips.push("👟 Try 10k steps — add post-dinner walk");
    if (totals.protein < 55) tips.push("🥚 Boost protein — eggs, chicken/fish, extra dal");
    if (totals.caloriesIn === 0 && hr > 9) tips.push("🍽️ Log kor meals!");
    if (totals.caloriesIn > 2300) tips.push("⚠️ Watch calories — rice kom kha");
    if (workoutCount === 0 && hr > 8) tips.push("🏃 Movement kor — even walk");
    if (tips.length === 0) tips.push(`✨ ${getMotivationSlang("praise")} Just stay consistent!`);
    return `Aji focus:\n\n${tips.join("\n")}\n\nRules:\n• Moderate rice, more dal & sabji\n• Less junk/oily food\n• Keep drinking water\n• Sleep by 10 PM\n\nSmall consistent improvements > big random changes. Koribo laage kor! 🔥`;
  }

  // General
  const score = Math.round(
    Math.min(100,(totals.steps/10000)*100)*0.2 + Math.min(100,(totals.waterMl/2500)*100)*0.2 +
    Math.min(100,(totals.totalKm/8)*100)*0.2 + Math.min(100,(totals.protein/80)*100)*0.2 +
    (workoutCount>0||(exerciseCount||0)>0?100:0)*0.2
  );
  const g = score>=85 ? `killing it! ${getMotivationSlang("praise")}` : score>=70 ? `doing well! 💚` : score>=50 ? `okay, but ${getMotivationSlang("generalRoast").split(".")[0]}` : `${getMotivationSlang("generalRoast")}`;
  let r = `Aji-r check-in:\n\n${g} Score: ${score}/100\n\n`;
  r += `🏃 ${totals.totalKm.toFixed(1)}km / ${totals.steps.toLocaleString()} steps${totals.totalKm>=5?" ✅":totals.totalKm>0?" 🔸":" ❌"}\n`;
  r += `🍽️ ${totals.caloriesIn} cal / ${totals.protein}g protein${totals.protein>=60?" ✅":totals.caloriesIn>0?" 🔸":" "}\n`;
  r += `💧 ${(totals.waterMl/1000).toFixed(1)}L / 2.5L${totals.waterMl>=2000?" ✅":totals.waterMl>0?" 🔸":" ❌"}\n`;
  r += `💪 Workouts: ${workoutCount}${workoutCount>0?" ✅":" ❌"}\n`;
  if ((exerciseCount||0)>0) r += `🏋️ Exercises: ${exerciseCount} ✅\n`;
  if (score>=75) r += `\nOn track! Keep it up lancha!`;
  else if (score>=50) r += `\nNot bad, but push it. ${getMotivationSlang("motivation").split(".")[0]}`;
  else r += `\n${getMotivationSlang("generalRoast")}\n${getMotivationSlang("motivation")}`;
  return r;
}

export default function AICoach({
  totals, workoutCount, foodCount, foods, sleep, exerciseCount, isOpen, onToggle,
  notification, onAddWorkout, onAddExercise, onAddFood, onAddWater, onAddSleep
}: {
  totals: Totals; workoutCount: number; foodCount: number; foods: FoodItem[];
  sleep?: number; exerciseCount: number; isOpen: boolean; onToggle: () => void;
  notification?: string | null;
  onAddWorkout?: (w: any) => void;
  onAddExercise?: (e: any) => void;
  onAddFood?: (f: any) => void;
  onAddWater?: (ml: number) => void;
  onAddSleep?: (s: any) => void;
}) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [typingMsgId, setTypingMsgId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: string; title?: string } | null>(null);
  const prevNotifRef = useRef<string | null>(null);

  useEffect(() => {
    if (messages.length === 0) {
      const hr = new Date().getHours();
      const greeting = hr < 12
        ? "Oi lancha! 🌅 Moi tor AI coach — tor ex-girlfriend-ot-koi beshi care korim aaj. 😤\n\nJust bol ki korili:\n• \"ran 5km\"\n• \"ate banana aru eggs\"\n• \"drank 500ml pani\"\n• \"slept 10pm to 6am\"\n• \"did 20 pushups\"\n\nMoi log korim — but korar aage toi sodhim (approval lage). Boka hoy thakibo na! 💪"
        : "Oi lancha! 👋 Moi tor coach. Aji ki korili moi buji parim — just bol!\n\nExamples:\n• \"ran 3km and walked 2km\"\n• \"ate rice dal aru fish\"\n• \"did 20 pushups 3 sets\"\n• \"drank 2 glasses of pani\"\n• \"slept 10pm to 6am\"\n\nMoi korar aage sodhim. Tor approval lagibo. Boka hoy thakibo na lancha! Let's go! 🔥";
      addCoachMessage(greeting);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (notification && notification !== prevNotifRef.current) {
      prevNotifRef.current = notification;
      const notif = generateNotification(notification, totals, workoutCount, foods);
      if (notif) {
        setToastMsg(notif);
        setTimeout(() => setToastMsg(null), 6000);
        const id = Math.random().toString(36).slice(2, 9);
        const msg: CoachMessage = { id, role: "notification", text: notif.text, type: notif.type, timestamp: timeNow() };
        setMessages(prev => [...prev, msg]);
      }
    }
  }, [notification, totals, workoutCount, foods]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, displayedText]);

  useEffect(() => {
    if (!typingMsgId) return;
    const msg = messages.find(m => m.id === typingMsgId);
    if (!msg) return;
    const fullText = msg.text;
    let i = 0;
    setDisplayedText("");
    setIsTyping(true);
    const interval = setInterval(() => {
      i++;
      setDisplayedText(fullText.slice(0, i));
      if (i >= fullText.length) { clearInterval(interval); setIsTyping(false); setTypingMsgId(null); }
    }, 14);
    return () => clearInterval(interval);
  }, [typingMsgId, messages]);

  const addCoachMessage = useCallback((text: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    const msg: CoachMessage = { id, role: "coach", text, timestamp: timeNow() };
    setMessages(prev => [...prev, msg]);
    setTypingMsgId(id);
  }, []);

  const handleSend = (text?: string) => {
    const query = text || input.trim();
    if (!query) return;
    const parsed = parseUserCommand(query);
    const userMsg: CoachMessage = { id: Math.random().toString(36).slice(2, 9), role: "user", text: query, timestamp: timeNow() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    if (parsed) {
      setPendingAction(parsed);
      const confirmMsg: CoachMessage = { id: Math.random().toString(36).slice(2, 9), role: "pending", text: `Moi bujilo! Here's what I found:\n\n${parsed.summary}\n\nTor log-t add korim? Yes/No bol!`, timestamp: timeNow(), pendingAction: parsed };
      setMessages(prev => [...prev, confirmMsg]);
      return;
    }
    setTimeout(() => {
      const response = generateCoachResponse(query, totals, workoutCount, foods, sleep, exerciseCount);
      addCoachMessage(response);
    }, 500 + Math.random() * 700);
  };

  const confirmAction = (action: PendingAction) => {
    setPendingAction(null);
    setMessages(prev => prev.filter(m => m.role !== "pending"));
    if (action.type === "workout" && onAddWorkout) onAddWorkout(action.data);
    if (action.type === "exercise" && onAddExercise) onAddExercise(action.data);
    if (action.type === "water" && onAddWater) onAddWater(action.data.amount);
    if (action.type === "sleep" && onAddSleep) onAddSleep(action.data);
    if (action.type === "food" && onAddFood) {
      if (Array.isArray(action.data)) action.data.forEach((f: any) => onAddFood(f));
      else onAddFood(action.data);
    }
    addCoachMessage(`✅ Log-t add korli! ${action.summary}. ${getMotivationSlang("praise")}`);
  };

  const rejectAction = () => {
    setPendingAction(null);
    setMessages(prev => prev.filter(m => m.role !== "pending"));
    addCoachMessage(`Thik ase, add koribo na. Change koribo hole bol! 👍`);
  };

  const liveInsights = useMemo(() => {
    const ins: { icon: React.ReactNode; text: string; color: string }[] = [];
    if (totals.waterMl < 1000 && totals.waterMl > 0) ins.push({ icon: <span>⚠️</span>, text: "Low water!", color: "text-amber-400" });
    if (totals.waterMl === 0) ins.push({ icon: <span>🚨</span>, text: "No water!", color: "text-red-400" });
    if (totals.waterMl >= 2500) ins.push({ icon: <span>💧</span>, text: "Hydration goal hit!", color: "text-blue-400" });
    if (totals.steps > 8000) ins.push({ icon: <span>🔥</span>, text: `${totals.steps.toLocaleString()} steps`, color: "text-emerald-400" });
    if (totals.protein >= 70) ins.push({ icon: <span>💪</span>, text: "Protein on point!", color: "text-cyan-400" });
    if (totals.protein < 30 && foodCount > 0) ins.push({ icon: <span>⚠️</span>, text: "Low protein", color: "text-amber-400" });
    if (workoutCount > 0) ins.push({ icon: <span>⚡</span>, text: `${workoutCount} workout${workoutCount>1?"s":""}`, color: "text-amber-400" });
    if (exerciseCount > 0) ins.push({ icon: <span>🏋️</span>, text: `${exerciseCount} exercise${exerciseCount>1?"s":""}`, color: "text-violet-400" });
    if (totals.caloriesIn > 2200) ins.push({ icon: <span>🔸</span>, text: "Over calorie limit", color: "text-orange-400" });
    return ins;
  }, [totals, workoutCount, foodCount, exerciseCount]);

  const toast = toastMsg && (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[400px] z-[60] anim-fade-down">
      <div className={`relative overflow-hidden rounded-2xl shadow-2xl backdrop-blur-xl ${
        toastMsg.type === "success" ? "bg-gradient-to-br from-emerald-950/95 to-emerald-900/95 ring-1 ring-emerald-500/30" :
        toastMsg.type === "warning" ? "bg-gradient-to-br from-amber-950/95 to-amber-900/95 ring-1 ring-amber-500/30" :
        toastMsg.type === "alert" ? "bg-gradient-to-br from-red-950/95 to-red-900/95 ring-1 ring-red-500/30" :
        "bg-gradient-to-br from-purple-950/95 to-purple-900/95 ring-1 ring-purple-500/30"
      }`}>
        {/* Phone-style notification header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <div className={`flex h-5 w-5 items-center justify-center rounded-md ${
              toastMsg.type === "success" ? "bg-emerald-500/20" :
              toastMsg.type === "warning" ? "bg-amber-500/20" :
              toastMsg.type === "alert" ? "bg-red-500/20" : "bg-purple-500/20"
            }`}>
              <Bot className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">AlokeshFitness Coach</span>
            <span className="text-[9px] text-white/40">{timeNow()}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-white/40 hover:text-white/70 transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Body */}
        <div className="px-4 pb-3">
          <p className={`text-[13px] leading-[1.5] font-medium ${
            toastMsg.type === "success" ? "text-emerald-200" :
            toastMsg.type === "warning" ? "text-amber-200" :
            toastMsg.type === "alert" ? "text-red-200" : "text-purple-200"
          }`}>{toastMsg.text}</p>
        </div>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-white/10 w-full">
          <div className="h-full bg-white/30" style={{ animation: "shrink 6s linear forwards" }} />
        </div>
      </div>
    </div>
  );

  if (!isOpen) {
    return (
      <>
        {toast}
        <button onClick={onToggle} className="fixed bottom-6 right-6 z-50 group">
          <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-xl anim-breathe" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-violet-700 shadow-xl shadow-purple-900/40 transition-transform group-hover:scale-110 anim-pulse-glow">
            <Bot className="h-6 w-6 text-white" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
            </span>
          </div>
          {toastMsg && <span className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold animate-bounce">!</span>}
        </button>
      </>
    );
  }

  return (
    <>
      {toast}
      <div className="fixed bottom-6 right-6 z-50 w-[400px] max-h-[calc(100vh-3rem)] flex flex-col anim-modal">
        <div className="relative overflow-hidden rounded-[24px] border border-purple-500/20 bg-[#080612]/95 shadow-2xl shadow-purple-900/20 backdrop-blur-2xl flex flex-col max-h-[calc(100vh-3rem)] anim-coach-glow">
          <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl anim-breathe" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-violet-500/8 blur-3xl anim-breathe delay-1000" />
          <div className="relative border-b border-white/5 px-5 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg anim-float">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute inset-0 grid place-items-center" style={{ animation: "orbit 4s linear infinite" }}>
                    <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-white">AI Coach</h3>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">boka hoy thakibo na • roast + motivate</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setExpanded(!expanded)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition">
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
                <button onClick={onToggle} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition"><X className="h-4 w-4" /></button>
              </div>
            </div>
            {liveInsights.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {liveInsights.map((ins, i) => (
                  <div key={i} className={`flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] ${ins.color} ring-1 ring-white/5 whitespace-nowrap anim-fade-up`} style={{ animationDelay: `${i * 100}ms` }}>
                    {ins.icon} {ins.text}
                  </div>
                ))}
              </div>
            )}
          </div>
          {expanded && (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto px-4 py-4" style={{ maxHeight: "360px" }}>
                {messages.map((msg, idx) => {
                  const isCoachTyping = msg.role === "coach" && msg.id === typingMsgId;
                  const textToShow = isCoachTyping ? displayedText : msg.text;
                  if (msg.role === "notification") {
                    return (
                      <div key={msg.id} className="anim-fade-up" style={{ animationDelay: `${Math.min(idx * 30, 150)}ms` }}>
                        <div className={`rounded-xl px-3 py-2 text-[11px] leading-[1.5] ${
                          msg.type === "success" ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20" :
                          msg.type === "warning" ? "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20" :
                          msg.type === "alert" ? "bg-red-500/10 text-red-300 ring-1 ring-red-500/20" :
                          "bg-purple-500/10 text-purple-300 ring-1 ring-purple-500/20"
                        }`}>
                          <div className="flex items-center gap-1.5 mb-1 text-[9px] uppercase tracking-wider opacity-60">
                            <Bot className="h-3 w-3" /> Coach • {msg.timestamp}
                          </div>
                          {msg.text}
                        </div>
                      </div>
                    );
                  }
                  if (msg.role === "pending" && msg.pendingAction) {
                    return (
                      <div key={msg.id} className="anim-fade-scale">
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-6 w-6 grid place-items-center rounded-lg bg-amber-500/15"><span className="text-amber-300 text-xs">📝</span></div>
                            <span className="text-[11px] font-medium text-amber-200">Confirm before adding</span>
                          </div>
                          <p className="text-[12px] text-zinc-300 whitespace-pre-wrap mb-3">{msg.text}</p>
                          <div className="flex gap-2">
                            <button onClick={() => confirmAction(msg.pendingAction!)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-[12px] font-medium text-black hover:bg-emerald-500 transition active:scale-95">
                              <Check className="h-3.5 w-3.5" /> Yes, add it
                            </button>
                            <button onClick={rejectAction} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white/5 py-2 text-[12px] text-zinc-300 hover:bg-white/10 transition active:scale-95 ring-1 ring-white/10">
                              <Trash2 className="h-3.5 w-3.5" /> No, skip
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""} anim-fade-up`} style={{ animationDelay: `${Math.min(idx * 30, 150)}ms` }}>
                      {msg.role === "coach" && (
                        <div className="flex-shrink-0">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/20 ring-1 ring-purple-500/20">
                            <Bot className="h-3.5 w-3.5 text-purple-300" />
                          </div>
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${msg.role === "coach" ? "bg-white/[0.04] ring-1 ring-white/5" : "bg-purple-600/20 ring-1 ring-purple-500/20"}`}>
                        <p className="text-[12px] leading-[1.6] text-zinc-200 whitespace-pre-wrap">
                          {textToShow}
                          {isCoachTyping && <span className="inline-block w-0.5 h-3.5 bg-purple-400 ml-0.5 align-text-bottom" style={{ animation: "blink 0.8s step-end infinite" }} />}
                        </p>
                        <div className="mt-1 text-[9px] text-zinc-600">{msg.timestamp}</div>
                      </div>
                    </div>
                  );
                })}
                {isTyping && !typingMsgId && (
                  <div className="flex gap-2.5 anim-fade-up">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/20 ring-1 ring-purple-500/20">
                      <Bot className="h-3.5 w-3.5 text-purple-300" />
                    </div>
                    <div className="rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/5">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-white/5 px-4 py-2.5 flex-shrink-0">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {COACH_PRESETS.map((preset, i) => (
                    <button key={preset} onClick={() => handleSend(preset)} disabled={isTyping || !!pendingAction}
                      className="whitespace-nowrap rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-zinc-400 ring-1 ring-white/5 transition hover:bg-purple-500/15 hover:text-purple-300 hover:ring-purple-500/20 disabled:opacity-50 anim-fade-up"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >{preset}</button>
                  ))}
                </div>
              </div>
              <div className="border-t border-white/5 px-4 py-3 flex-shrink-0">
                <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                  <input value={input} onChange={e => setInput(e.target.value)} placeholder={pendingAction ? "confirm above first..." : "just bol ki korili..."} disabled={isTyping || !!pendingAction}
                    className="flex-1 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-[12px] outline-none ring-1 ring-white/10 focus:ring-purple-500/40 transition placeholder:text-zinc-600 disabled:opacity-50"
                  />
                  <button type="submit" disabled={isTyping || !input.trim() || !!pendingAction}
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-purple-600 transition hover:bg-purple-500 disabled:opacity-40 active:scale-90"
                  ><Send className="h-4 w-4 text-white" /></button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
