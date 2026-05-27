import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Bot, ChevronDown, ChevronUp, Send, Sparkles, X, AlertTriangle, Check, Trash2 } from "lucide-react";

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

/* ─── Natural Language Parser ─── */
function parseUserCommand(text: string): PendingAction | null {
  const t = text.toLowerCase();

  // Workout: ran 5km, run 3 km, walked 2km, jogged 4km
  const runMatch = t.match(/(?:ran|run|jogged|jog)\s+(\d+(?:\.\d+)?)\s*(?:km|k)/);
  if (runMatch) {
    const km = parseFloat(runMatch[1]);
    const durMatch = t.match(/(\d+)\s*(?:min|minute)/);
    const duration = durMatch ? parseInt(durMatch[1]) : Math.round(km * 6);
    return {
      id: uid(),
      type: "workout",
      summary: `Run — ${km}km, ~${duration}min`,
      data: { type: "run" as const, km, duration, title: "Run", time: timeNow(), notes: "" },
    };
  }

  const walkMatch = t.match(/(?:walked|walk)\s+(\d+(?:\.\d+)?)\s*(?:km|k)/);
  if (walkMatch) {
    const km = parseFloat(walkMatch[1]);
    const durMatch = t.match(/(\d+)\s*(?:min|minute)/);
    const duration = durMatch ? parseInt(durMatch[1]) : Math.round(km * 12);
    return {
      id: uid(),
      type: "workout",
      summary: `Walk — ${km}km, ~${duration}min`,
      data: { type: "walk" as const, km, duration, title: "Walk", time: timeNow(), notes: "" },
    };
  }

  // Exercise: did 20 pushups 3 sets, 15 push-ups
  const exMatch = t.match(/(?:did\s+)?(\d+)\s*(?:push[\s-]?ups?|pushups)/);
  if (exMatch) {
    const reps = parseInt(exMatch[1]);
    const setsMatch = t.match(/(\d+)\s*(?:sets?)/);
    const sets = setsMatch ? parseInt(setsMatch[1]) : 1;
    return {
      id: uid(),
      type: "exercise",
      summary: `Push-ups — ${sets} sets × ${reps} reps`,
      data: { name: "Push-ups", reps, sets, duration: 30, time: timeNow(), notes: "" },
    };
  }

  const squatMatch = t.match(/(?:did\s+)?(\d+)\s*(?:squats?)/);
  if (squatMatch) {
    const reps = parseInt(squatMatch[1]);
    const setsMatch = t.match(/(\d+)\s*(?:sets?)/);
    const sets = setsMatch ? parseInt(setsMatch[1]) : 1;
    return {
      id: uid(),
      type: "exercise",
      summary: `Squats — ${sets} sets × ${reps} reps`,
      data: { name: "Squats", reps, sets, duration: 30, time: timeNow(), notes: "" },
    };
  }

  const plankMatch = t.match(/(?:did\s+)?plank\s+(?:for\s+)?(\d+)\s*(?:sec|seconds?)/);
  if (plankMatch) {
    const sec = parseInt(plankMatch[1]);
    return {
      id: uid(),
      type: "exercise",
      summary: `Plank — ${sec} seconds`,
      data: { name: "Plank", reps: 1, sets: 1, duration: sec, time: timeNow(), notes: "" },
    };
  }

  // Water: drank 500ml water, had 2 glasses
  const waterMatch = t.match(/(?:drank|had|consumed)\s+(\d+(?:\.\d+)?)\s*(?:ml|mL)\s*(?:of\s+)?(?:water|paani|pani)/);
  if (waterMatch) {
    const ml = parseFloat(waterMatch[1]);
    return {
      id: uid(),
      type: "water",
      summary: `Water — ${ml}ml`,
      data: { amount: ml },
    };
  }
  const glassMatch = t.match(/(?:drank|had)\s+(\d+)\s*(?:glass|glasses)\s*(?:of\s+)?(?:water|paani|pani)/);
  if (glassMatch) {
    const ml = parseInt(glassMatch[1]) * 250;
    return {
      id: uid(),
      type: "water",
      summary: `Water — ${glassMatch[1]} glass${parseInt(glassMatch[1]) > 1 ? "es" : ""} (~${ml}ml)`,
      data: { amount: ml },
    };
  }

  // Food: ate banana and eggs, had rice dal
  const foodMatch = t.match(/(?:ate|had|eat|eating)\s+(.+)/);
  if (foodMatch) {
    const foodText = foodMatch[1].trim();
    // Try to match known foods
    const knownFoods: Record<string, { cal: number; p: number; cb: number; f: number; meal: string }> = {
      "banana": { cal: 105, p: 1, cb: 27, f: 0, meal: "breakfast" },
      "egg": { cal: 78, p: 6, cb: 1, f: 5, meal: "breakfast" },
      "eggs": { cal: 156, p: 13, cb: 1, f: 11, meal: "breakfast" },
      "tea": { cal: 30, p: 1, cb: 7, f: 1, meal: "breakfast" },
      "chai": { cal: 30, p: 1, cb: 7, f: 1, meal: "breakfast" },
      "chana": { cal: 210, p: 12, cb: 27, f: 5, meal: "breakfast" },
      "dal": { cal: 180, p: 9, cb: 30, f: 3, meal: "lunch" },
      "rice": { cal: 200, p: 4, cb: 45, f: 1, meal: "lunch" },
      "sabji": { cal: 120, p: 3, cb: 15, f: 5, meal: "lunch" },
      "fish": { cal: 220, p: 22, cb: 8, f: 12, meal: "lunch" },
      "chicken": { cal: 250, p: 25, cb: 10, f: 14, meal: "lunch" },
      "roti": { cal: 120, p: 3, cb: 21, f: 2, meal: "dinner" },
      "peanuts": { cal: 160, p: 7, cb: 5, f: 14, meal: "snack" },
      "curd": { cal: 60, p: 3, cb: 5, f: 3, meal: "snack" },
      "dahi": { cal: 60, p: 3, cb: 5, f: 3, meal: "snack" },
      "milk": { cal: 150, p: 8, cb: 12, f: 8, meal: "snack" },
    };

    const foundFoods: { name: string; cal: number; p: number; cb: number; f: number; meal: string }[] = [];
    let totalCal = 0, totalP = 0;
    for (const [key, data] of Object.entries(knownFoods)) {
      if (foodText.includes(key)) {
        foundFoods.push({ name: key.charAt(0).toUpperCase() + key.slice(1), ...data });
        totalCal += data.cal;
        totalP += data.p;
      }
    }

    if (foundFoods.length > 0) {
      return {
        id: uid(),
        type: "food",
        summary: `${foundFoods.map(f => f.name).join(" + ")} — ${totalCal} cal, ${totalP}g protein`,
        data: foundFoods.map(f => ({
          name: f.name,
          meal: f.meal as any,
          calories: f.cal,
          protein: f.p,
          carbs: f.cb,
          fat: f.f,
          time: timeNow(),
        })),
      };
    }
  }

  // Sleep: slept from 10pm to 6am, slept 8 hours
  const sleepMatch = t.match(/(?:slept|sleep)\s+(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:pm|am)?\s+(?:to|until|till)\s+(\d{1,2})(?::(\d{2}))?\s*(?:pm|am)?/);
  if (sleepMatch) {
    let bh = parseInt(sleepMatch[1]);
    let bm = sleepMatch[2] ? parseInt(sleepMatch[2]) : 0;
    let wh = parseInt(sleepMatch[3]);
    let wm = sleepMatch[4] ? parseInt(sleepMatch[4]) : 0;
    // Simple AM/PM handling
    if (t.includes("pm") && bh < 12) bh += 12;
    if (t.includes("am") && wh < 12 && wh < bh) wh += 12;
    const bedTime = `${bh.toString().padStart(2, "0")}:${bm.toString().padStart(2, "0")}`;
    const wakeTime = `${wh.toString().padStart(2, "0")}:${wm.toString().padStart(2, "0")}`;
    const isNap = t.includes("nap");
    return {
      id: uid(),
      type: "sleep",
      summary: `${isNap ? "Nap" : "Sleep"} — ${bedTime} → ${wakeTime}`,
      data: { bedTime, wakeTime, isNap },
    };
  }

  return null;
}

function generateCoachResponse(
  query: string, totals: Totals, workoutCount: number,
  foods: FoodItem[], sleep?: number, exerciseCount?: number
): string {
  const q = query.toLowerCase();
  const foodCount = foods.length;
  const hr = new Date().getHours();

  // Water
  if (q.includes("water") || q.includes("hydrat") || q.includes("drink") || q.includes("paani") || q.includes("pani")) {
    const liters = (totals.waterMl / 1000).toFixed(1);
    if (totals.waterMl >= 2500) return `nice yaar, ${liters}L done! 💧 that's solid. your body's properly fueled up. after ${totals.totalKm.toFixed(1)}km of movement today, this is exactly what you need.`;
    if (totals.waterMl >= 1500) return `${liters}L so far — not bad, but you're ${((2500 - totals.waterMl) / 1000).toFixed(1)}L away from the goal still. try finishing another bottle before dinner.`;
    if (totals.waterMl > 0) return `only ${liters}L? come on yaar, that's way too low 😬 grab your bottle right now and finish at least 500ml.`;
    return `bro you haven't logged any water today?? 🚨 go drink a full glass right now — seriously.`;
  }

  // Protein / macros
  if (q.includes("protein") || q.includes("muscle") || q.includes("recovery") || q.includes("macro")) {
    const p = totals.protein;
    const totalCarbs = foods.reduce((a, b) => a + b.carbs, 0);
    const totalFat = foods.reduce((a, b) => a + b.fat, 0);
    let response = `alright let me break down your macros today:\n\n`;
    response += `🥩 Protein: ${p}g${p >= 70 ? " — solid!" : p >= 45 ? " — decent, push higher" : " — too low bro"}\n`;
    response += `🌾 Carbs: ${totalCarbs}g${totalCarbs > 300 ? " — careful, too much rice?" : " — looks fine"}\n`;
    response += `🥑 Fat: ${totalFat}g\n\n`;
    if (p < 50) response += `to fix protein: add eggs (12g for 2), chicken/fish (22-25g), or extra dal (9g per bowl).`;
    else if (p >= 70) response += `you're hitting good numbers. keep including eggs + dal + chicken/fish regularly.`;
    else response += `you're in the okay zone, but for ${totals.totalKm.toFixed(1)}km activity, push for 70g+.`;
    return response;
  }

  // Food / meals
  if (q.includes("meal") || q.includes("food") || q.includes("eat") || q.includes("nutrition") || q.includes("diet") || q.includes("calor") || q.includes("rate my") || q.includes("khaana") || q.includes("khana")) {
    if (foodCount === 0) {
      if (hr < 8) return `morning! haven't eaten yet? after your run, have banana + tea + eggs (or dal/chana if no eggs).`;
      if (hr < 13) return `hey it's ${hr > 12 ? "afternoon" : "late morning"} and no food logged. don't skip breakfast yaar.`;
      return `no meals logged today? bro track your food — even simple dal roti. tap "Add Food" and log it!`;
    }
    let response = `let me review what you've eaten today 🍽️\n\n`;
    const meals = { breakfast: foods.filter(f => f.meal === "breakfast"), lunch: foods.filter(f => f.meal === "lunch"), dinner: foods.filter(f => f.meal === "dinner"), snack: foods.filter(f => f.meal === "snack") };
    if (meals.breakfast.length > 0) { const bCal = meals.breakfast.reduce((a, b) => a + b.calories, 0); const bPro = meals.breakfast.reduce((a, b) => a + b.protein, 0); response += `☀️ Breakfast: ${meals.breakfast.map(f => f.name).join(", ")} — ${bCal} cal, ${bPro}g protein\n`; }
    if (meals.lunch.length > 0) { const lCal = meals.lunch.reduce((a, b) => a + b.calories, 0); const lPro = meals.lunch.reduce((a, b) => a + b.protein, 0); response += `🌤️ Lunch: ${meals.lunch.map(f => f.name).join(", ")} — ${lCal} cal, ${lPro}g protein\n`; }
    if (meals.dinner.length > 0) { const dCal = meals.dinner.reduce((a, b) => a + b.calories, 0); response += `🌙 Dinner: ${meals.dinner.map(f => f.name).join(", ")} — ${dCal} cal\n`; }
    response += `\n📊 Total: ${totals.caloriesIn} cal | ${totals.protein}g protein\n`;
    if (totals.caloriesIn > 2200) response += `\n⚠️ you're going over 2200 cal — watch the rice portions.`;
    else if (totals.caloriesIn > 1800) response += `\n✅ calories look balanced.`;
    else if (totals.caloriesIn > 0) response += `\n🔸 you're a bit under — eat properly at your next meal.`;
    return response;
  }

  // What to eat next
  if (q.includes("what should i eat") || q.includes("suggest food") || q.includes("next meal") || q.includes("kya khaun")) {
    const breakfastLogged = foods.some(f => f.meal === "breakfast");
    const lunchLogged = foods.some(f => f.meal === "lunch");
    const dinnerLogged = foods.some(f => f.meal === "dinner");
    if (!breakfastLogged && hr < 10) return `for breakfast (after your run):\n\n🍌 Banana — 105 cal\n🍵 Tea (less sugar) — 30 cal\n🥚 2 Boiled Eggs — 156 cal, 12.6g protein\n\nor if no eggs:\n🫘 Chana/Dal — ~180-210 cal, 9-12g protein\n🥜 Peanuts — 160 cal, 7g protein\n\ntotal: ~290-350 cal, 14-20g protein. log it when you eat 👍`;
    if (!lunchLogged && hr < 16) return `for lunch:\n\n🍚 Rice (moderate! don't fill plate)\n🫘 Dal — 180 cal, 9g protein\n🥘 Sabji — 120 cal\n${totals.protein < 40 ? "🐟 Fish or chicken if available — 22-25g protein!" : ""}\n\nmore dal & sabji, less rice. ~500-700 cal.`;
    if (!dinnerLogged) return `for dinner, keep it clean:\n\n🫓 2 Roti — 240 cal, 7g protein\n🥘 Sabji — 120 cal\n🫘 Dal — 180 cal, 9g protein\n\n~540 cal, 19g protein. eat by 8:30 PM, sleep by 10 PM! 🌙`;
    return `you've had all main meals! if hungry, grab curd (60 cal) or fruit. avoid oily/junk now.`;
  }

  // Workout
  if (q.includes("workout") || q.includes("exercise") || q.includes("run") || q.includes("walk") || q.includes("review")) {
    if (totals.totalKm >= 8) return `bro ${totals.totalKm.toFixed(1)}km? that's INSANE today! 🔥 ${totals.steps.toLocaleString()} steps. drink water, eat protein, stretch, and sleep by 10 PM.`;
    if (totals.totalKm >= 4) return `solid effort — ${totals.totalKm.toFixed(1)}km (${totals.steps.toLocaleString()} steps). try interval sprints: 1 min fast / 2 min slow.`;
    if (totals.totalKm > 0) return `${totals.totalKm.toFixed(1)}km done — it's a start! 👟 add a post-dinner walk for digestion.`;
    if (hr < 8) return `haven't headed out for your morning run yet? try to get it done before 7 AM while it's cool.`;
    return `no workout logged today 😕 try at least a 15-min walk — keeps the habit alive.`;
  }

  // Sleep
  if (q.includes("sleep") || q.includes("rest") || q.includes("tired") || q.includes("neend")) {
    if (sleep && sleep >= 7) return `${sleep.toFixed(1)} hours — good job! 😴 with ${totals.totalKm.toFixed(1)}km today, 7+ hours is exactly what you need.`;
    if (sleep) return `only ${sleep.toFixed(1)} hours? yaar that's not enough 😬 you need 7-8 hours. no phone after 9:30 PM, bed by 10.`;
    return `sleep is the #1 recovery tool. 7-8 hours helps muscle recovery, balances hunger hormones. set an alarm for 9:30 PM to wind down!`;
  }

  // Improvement
  if (q.includes("improve") || q.includes("better") || q.includes("suggest") || q.includes("advice") || q.includes("tip") || q.includes("help")) {
    const tips: string[] = [];
    if (totals.waterMl < 2000) tips.push("💧 drink more water — at " + (totals.waterMl/1000).toFixed(1) + "L, need 2.5L");
    if (totals.steps < 8000) tips.push("👟 try to hit 10k steps — add a post-dinner walk");
    if (totals.protein < 55) tips.push("🥚 boost protein — add eggs, chicken/fish, or extra dal");
    if (totals.caloriesIn === 0 && hr > 9) tips.push("🍽️ log your meals!");
    if (totals.caloriesIn > 2300) tips.push("⚠️ watch calories — probably too much rice");
    if (workoutCount === 0 && hr > 8) tips.push("🏃 get some movement in");
    if (tips.length === 0) tips.push("✨ honestly? you're doing great. just stay consistent");
    return `here's what i'd focus on:\n\n${tips.join("\n")}\n\nremember your rules:\n• moderate rice, more dal & sabji\n• less junk/oily food\n• keep drinking water\n• sleep by 10 PM\n\nsmall consistent improvements > big random changes. you got this! 🔥`;
  }

  // General
  const score = Math.round(
    Math.min(100, (totals.steps / 10000) * 100) * 0.2 +
    Math.min(100, (totals.waterMl / 2500) * 100) * 0.2 +
    Math.min(100, (totals.totalKm / 8) * 100) * 0.2 +
    Math.min(100, (totals.protein / 80) * 100) * 0.2 +
    (workoutCount > 0 || (exerciseCount || 0) > 0 ? 100 : 0) * 0.2
  );
  const g = score >= 85 ? "killing it! 🏆" : score >= 70 ? "doing well! 💚" : score >= 50 ? "okay, but room to improve ⚡" : "let's step it up today 💪";
  let response = `alright, here's your honest check-in:\n\n${g} your day score: ${score}/100\n\n`;
  response += `🏃 Activity: ${totals.totalKm.toFixed(1)}km / ${totals.steps.toLocaleString()} steps${totals.totalKm >= 5 ? " ✅" : totals.totalKm > 0 ? " 🔸" : " ❌"}\n`;
  response += `🍽️ Food: ${totals.caloriesIn} cal / ${totals.protein}g protein${totals.protein >= 60 ? " ✅" : totals.caloriesIn > 0 ? " 🔸" : " ❌"}\n`;
  response += `💧 Water: ${(totals.waterMl/1000).toFixed(1)}L / 2.5L${totals.waterMl >= 2000 ? " ✅" : totals.waterMl > 0 ? " 🔸" : " ❌"}\n`;
  response += `💪 Workouts: ${workoutCount}${workoutCount > 0 ? " ✅" : " ❌"}\n`;
  if ((exerciseCount || 0) > 0) response += `🏋️ Exercises: ${exerciseCount} logged ✅\n`;
  if (score >= 75) response += `\nyou're on track. keep it up!`;
  else if (score >= 50) response += `\nnot bad, but let's push it.`;
  else response += `\nwe gotta work on this.`;
  return response;
}

function generateNotification(
  event: string, totals: Totals, _workoutCount: number, foods: FoodItem[]
): { text: string; type: "success" | "warning" | "info" | "alert" } | null {
  if (event === "workout") {
    if (totals.totalKm >= 5) return { text: `nice run! ${totals.totalKm.toFixed(1)}km logged (${totals.steps.toLocaleString()} steps). don't forget post-workout meal — banana + eggs + tea 🍌`, type: "success" };
    if (totals.totalKm > 0) return { text: `${totals.totalKm.toFixed(1)}km added! ${totals.waterMl < 1000 ? "you need more water though — grab your bottle! 💧" : "keep going 👟"}`, type: "info" };
    return null;
  }
  if (event === "exercise") return { text: `exercise logged! 💪 keep building that strength.`, type: "success" };
  if (event === "food") {
    const lastFood = foods[foods.length - 1];
    if (!lastFood) return null;
    if (totals.caloriesIn > 2200) return { text: `heads up — you're at ${totals.caloriesIn} cal now. that's over 2200. watch portions.`, type: "warning" };
    if (totals.protein >= 70 && totals.caloriesIn >= 1500) return { text: `${lastFood.name} logged ✅ nutrition looking solid — ${totals.caloriesIn} cal, ${totals.protein}g protein.`, type: "success" };
    if (totals.protein < 30 && foods.length >= 2) return { text: `${lastFood.name} added. but protein is only ${totals.protein}g — you need more. try eggs, chicken, fish, or extra dal.`, type: "warning" };
    return { text: `${lastFood.name} logged! ${totals.caloriesIn} cal total. keep it balanced 🍽️`, type: "info" };
  }
  if (event === "water") {
    if (totals.waterMl >= 2500) return { text: `💧 ${(totals.waterMl/1000).toFixed(1)}L — you hit the 2.5L goal! amazing. 🎉`, type: "success" };
    if (totals.waterMl >= 1500) return { text: `good, ${(totals.waterMl/1000).toFixed(1)}L now. ${((2500 - totals.waterMl)/1000).toFixed(1)}L more to hit the goal.`, type: "info" };
    if (totals.waterMl < 500 && totals.totalKm > 0) return { text: `only ${totals.waterMl}ml after working out ${totals.totalKm.toFixed(1)}km?? drink up! 🚨`, type: "alert" };
    return { text: `+water logged! ${(totals.waterMl/1000).toFixed(1)}L total.`, type: "info" };
  }
  if (event === "sleep") return { text: `sleep logged! rest is just as important as the workout. 😴`, type: "success" };
  return null;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
  const [toastMsg, setToastMsg] = useState<{ text: string; type: string } | null>(null);
  const prevNotifRef = useRef<string | null>(null);

  useEffect(() => {
    if (messages.length === 0) {
      const hr = new Date().getHours();
      const greeting = hr < 12
        ? `hey good morning! ☀️ i'm your AI coach. i can understand what you tell me and add it to your log.\n\nfor example, try saying:\n• "i ran 5km today"\n• "i ate banana and eggs"\n• "i drank 500ml water"\n• "i slept from 10pm to 6am"\n\ni'll ask before adding anything. you can also just chat with me normally! 💪`
        : `hey! 👋 i'm your AI coach. just tell me what you did and i'll help log it.\n\nexamples:\n• "ran 3km and walked 2km"\n• "had rice dal and fish for lunch"\n• "did 20 pushups"\n• "drank 2 glasses of water"\n\ni'll always ask before adding to your log. let's go! 🔥`;
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
        setTimeout(() => setToastMsg(null), 5000);
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

    // First, try to parse as a command
    const parsed = parseUserCommand(query);

    const userMsg: CoachMessage = { id: Math.random().toString(36).slice(2, 9), role: "user", text: query, timestamp: timeNow() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    if (parsed) {
      // Show confirmation instead of normal response
      setPendingAction(parsed);
      const confirmMsg: CoachMessage = {
        id: Math.random().toString(36).slice(2, 9),
        role: "pending",
        text: `i understood! here's what i found:\n\n${parsed.summary}\n\ndo you want me to add this to your log?`,
        timestamp: timeNow(),
        pendingAction: parsed,
      };
      setMessages(prev => [...prev, confirmMsg]);
      return;
    }

    // Normal chat response
    setTimeout(() => {
      const response = generateCoachResponse(query, totals, workoutCount, foods, sleep, exerciseCount);
      addCoachMessage(response);
    }, 500 + Math.random() * 700);
  };

  const confirmAction = (action: PendingAction) => {
    setPendingAction(null);
    // Remove the pending message
    setMessages(prev => prev.filter(m => m.role !== "pending"));

    if (action.type === "workout" && onAddWorkout) onAddWorkout(action.data);
    if (action.type === "exercise" && onAddExercise) onAddExercise(action.data);
    if (action.type === "water" && onAddWater) onAddWater(action.data.amount);
    if (action.type === "sleep" && onAddSleep) onAddSleep(action.data);
    if (action.type === "food" && onAddFood) {
      if (Array.isArray(action.data)) {
        action.data.forEach((f: any) => onAddFood(f));
      } else {
        onAddFood(action.data);
      }
    }

    addCoachMessage(`✅ added to your log! ${action.summary}`);
  };

  const rejectAction = () => {
    setPendingAction(null);
    setMessages(prev => prev.filter(m => m.role !== "pending"));
    addCoachMessage(`okay, i won't add it. let me know if you change your mind! 👍`);
  };

  const liveInsights = useMemo(() => {
    const ins: { icon: React.ReactNode; text: string; color: string }[] = [];
    if (totals.waterMl < 1000 && totals.waterMl > 0) ins.push({ icon: <span>⚠️</span>, text: "Low water!", color: "text-amber-400" });
    if (totals.waterMl === 0) ins.push({ icon: <span>🚨</span>, text: "No water!", color: "text-red-400" });
    if (totals.waterMl >= 2500) ins.push({ icon: <span>💧</span>, text: "Hydration goal hit!", color: "text-blue-400" });
    if (totals.steps > 8000) ins.push({ icon: <span>🔥</span>, text: `${totals.steps.toLocaleString()} steps`, color: "text-emerald-400" });
    if (totals.protein >= 70) ins.push({ icon: <span>💪</span>, text: "Protein on point!", color: "text-cyan-400" });
    if (totals.protein < 30 && foodCount > 0) ins.push({ icon: <span>⚠️</span>, text: "Low protein", color: "text-amber-400" });
    if (workoutCount > 0) ins.push({ icon: <span>⚡</span>, text: `${workoutCount} workout${workoutCount > 1 ? "s" : ""}`, color: "text-amber-400" });
    if (exerciseCount > 0) ins.push({ icon: <span>🏋️</span>, text: `${exerciseCount} exercise${exerciseCount > 1 ? "s" : ""}`, color: "text-violet-400" });
    if (totals.caloriesIn > 2200) ins.push({ icon: <span>🔸</span>, text: "Over calorie limit", color: "text-orange-400" });
    return ins;
  }, [totals, workoutCount, foodCount, exerciseCount]);

  const toast = toastMsg && (
    <div className={`fixed top-4 right-4 z-[60] max-w-sm anim-fade-down`}>
      <div className={`relative overflow-hidden rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
        toastMsg.type === "success" ? "border-emerald-500/30 bg-emerald-950/90 text-emerald-200" :
        toastMsg.type === "warning" ? "border-amber-500/30 bg-amber-950/90 text-amber-200" :
        toastMsg.type === "alert" ? "border-red-500/30 bg-red-950/90 text-red-200" :
        "border-purple-500/30 bg-purple-950/90 text-purple-200"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 mt-0.5 ${toastMsg.type === "alert" ? "text-red-400" : toastMsg.type === "success" ? "text-emerald-400" : toastMsg.type === "warning" ? "text-amber-400" : "text-purple-400"}`}>
            {toastMsg.type === "alert" ? <AlertTriangle className="h-5 w-5 anim-float" /> : <Bot className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">Coach Feedback</div>
            <p className="text-[12px] leading-[1.5]">{toastMsg.text}</p>
          </div>
          <button onClick={() => setToastMsg(null)} className="flex-shrink-0 opacity-50 hover:opacity-100 transition"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="absolute bottom-0 left-0 h-0.5 bg-white/20 w-full">
          <div className="h-full bg-white/40" style={{ animation: "shrink 5s linear forwards" }} />
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
                    <h3 className="text-[14px] font-semibold text-white">AI Health Coach</h3>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">understands natural language • asks before adding</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setExpanded(!expanded)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition">
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
                <button onClick={onToggle} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition">
                  <X className="h-4 w-4" />
                </button>
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
                            <div className="h-6 w-6 grid place-items-center rounded-lg bg-amber-500/15">
                              <span className="text-amber-300 text-xs">📝</span>
                            </div>
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
                  <input value={input} onChange={e => setInput(e.target.value)} placeholder={pendingAction ? "confirm above first..." : "tell me what you did..."} disabled={isTyping || !!pendingAction}
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
