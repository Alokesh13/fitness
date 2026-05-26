import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Bot, ChevronDown, ChevronUp, Send, Sparkles, X, AlertTriangle } from "lucide-react";

type Totals = {
  runKm: number; walkKm: number; totalKm: number; steps: number;
  caloriesOut: number; caloriesIn: number; waterMl: number; protein: number;
};

type FoodItem = {
  name: string; calories: number; protein: number; carbs: number; fat: number;
  meal: string;
};

type CoachMessage = {
  id: string;
  role: "coach" | "user" | "notification";
  text: string;
  timestamp: string;
  type?: "success" | "warning" | "info" | "alert";
};

// Your diet is fully encoded into the coach's response logic below

const COACH_PRESETS = [
  "How's my day going?",
  "Rate my meals today",
  "Am I hydrated enough?",
  "What should I eat next?",
  "Review my workout",
  "Help me improve",
];

function generateCoachResponse(
  query: string, totals: Totals, workoutCount: number, 
  foods: FoodItem[], sleep?: number
): string {
  const q = query.toLowerCase();
  const foodCount = foods.length;
  const hr = new Date().getHours();

  // ──── WATER ────
  if (q.includes("water") || q.includes("hydrat") || q.includes("drink") || q.includes("paani") || q.includes("pani")) {
    const liters = (totals.waterMl / 1000).toFixed(1);
    if (totals.waterMl >= 2500) return `nice yaar, ${liters}L done! 💧 that's solid. your body's properly fueled up. after ${totals.totalKm.toFixed(1)}km of movement today, this is exactly what you need. keep a bottle near you and just sip throughout — you're doing great.`;
    if (totals.waterMl >= 1500) return `${liters}L so far — not bad, but you're ${((2500 - totals.waterMl) / 1000).toFixed(1)}L away from the goal still. you've moved ${totals.totalKm.toFixed(1)}km today, so your body definitely needs more. try finishing another bottle before dinner. every sip counts bro 💪`;
    if (totals.waterMl > 0) return `only ${liters}L? come on yaar, that's way too low 😬 you need to drink way more — especially after working out. dehydration kills your recovery and makes you tired. grab your bottle right now and finish at least 500ml. i'm watching! 👀`;
    return `bro you haven't logged any water today?? 🚨 that's not good at all. your body needs at least 2.5L, especially on active days. go drink a full glass right now — seriously. start with 250ml and build from there. i'll keep checking on you 💧`;
  }

  // ──── PROTEIN / MACROS ────
  if (q.includes("protein") || q.includes("muscle") || q.includes("recovery") || q.includes("macro")) {
    const p = totals.protein;
    const totalCarbs = foods.reduce((a, b) => a + b.carbs, 0);
    const totalFat = foods.reduce((a, b) => a + b.fat, 0);
    
    let response = `alright let me break down your macros today:\n\n`;
    response += `🥩 Protein: ${p}g`;
    if (p >= 70) response += ` — solid! that's good for recovery\n`;
    else if (p >= 45) response += ` — decent, but try to push it higher\n`;
    else response += ` — too low bro, you need more\n`;
    
    response += `🌾 Carbs: ${totalCarbs}g`;
    if (totalCarbs > 300) response += ` — careful, that's quite high. maybe you had too much rice?\n`;
    else response += ` — looks fine\n`;
    
    response += `🥑 Fat: ${totalFat}g — ${totalFat > 70 ? "a bit high, go easy on the oil" : "within range"}\n\n`;

    if (p < 50) {
      response += `to fix the protein: add eggs in the morning (12g for 2 eggs), or have chicken/fish at lunch (22-25g). even dal gives you 9g per bowl. peanuts add 7g per handful. small changes add up!`;
    } else if (p >= 70) {
      response += `you're hitting good numbers. with your current diet, if you keep including eggs + dal + chicken/fish regularly, you'll consistently stay in the 60-80g range which is great for your activity level.`;
    } else {
      response += `you're in the okay zone, but for someone running ${totals.totalKm.toFixed(1)}km, i'd push for 70g+. add an extra egg or swap some rice for more dal at lunch.`;
    }
    return response;
  }

  // ──── FOOD / MEALS / NUTRITION ────
  if (q.includes("meal") || q.includes("food") || q.includes("eat") || q.includes("nutrition") || q.includes("diet") || q.includes("calor") || q.includes("rate my") || q.includes("khaana") || q.includes("khana")) {
    if (foodCount === 0) {
      if (hr < 8) return `morning! haven't eaten yet? that's fine if you're about to run first 🏃 but remember — right after your run, have a banana + tea + eggs (or dal/chana if no eggs). that post-run window is important for recovery.`;
      if (hr < 13) return `hey it's ${hr > 12 ? "afternoon" : "late morning"} and no food logged yet. if you haven't eaten, please don't skip breakfast yaar. a banana + eggs + tea gives you ~290 cal and 14g protein to start the day. log what you ate!`;
      return `no meals logged today? bro track your food — even if it's simple dal roti, i need to see what's going in to give you proper advice. tap "Add Food" and log it!`;
    }

    let response = `let me review what you've eaten today 🍽️\n\n`;
    
    const meals = { breakfast: foods.filter(f => f.meal === "breakfast"), lunch: foods.filter(f => f.meal === "lunch"), dinner: foods.filter(f => f.meal === "dinner"), snack: foods.filter(f => f.meal === "snack") };
    
    if (meals.breakfast.length > 0) {
      const bCal = meals.breakfast.reduce((a, b) => a + b.calories, 0);
      const bPro = meals.breakfast.reduce((a, b) => a + b.protein, 0);
      response += `☀️ Breakfast: ${meals.breakfast.map(f => f.name).join(", ")} — ${bCal} cal, ${bPro}g protein\n`;
      if (bPro < 10) response += `   → protein's a bit low, try adding eggs next time\n`;
    }
    if (meals.lunch.length > 0) {
      const lCal = meals.lunch.reduce((a, b) => a + b.calories, 0);
      const lPro = meals.lunch.reduce((a, b) => a + b.protein, 0);
      const lCarbs = meals.lunch.reduce((a, b) => a + b.carbs, 0);
      response += `🌤️ Lunch: ${meals.lunch.map(f => f.name).join(", ")} — ${lCal} cal, ${lPro}g protein\n`;
      if (lCarbs > 80) response += `   → easy on the rice bro, that's a lot of carbs\n`;
      if (lPro >= 20) response += `   → nice protein from the ${meals.lunch.find(f => f.protein > 15)?.name || "protein source"} 👍\n`;
    }
    if (meals.dinner.length > 0) {
      const dCal = meals.dinner.reduce((a, b) => a + b.calories, 0);
      response += `🌙 Dinner: ${meals.dinner.map(f => f.name).join(", ")} — ${dCal} cal\n`;
    }
    if (meals.snack.length > 0) {
      response += `🫐 Snacks: ${meals.snack.map(f => f.name).join(", ")}\n`;
    }

    response += `\n📊 Total: ${totals.caloriesIn} cal | ${totals.protein}g protein\n`;
    
    if (totals.caloriesIn > 2200) response += `\n⚠️ you're going over 2200 cal — watch the portions, especially rice. more dal & sabji, less rice on the plate.`;
    else if (totals.caloriesIn > 1800) response += `\n✅ calories look balanced. you're in a good range.`;
    else if (totals.caloriesIn > 0) response += `\n🔸 you're a bit under — make sure you eat properly at your next meal. don't skip.`;

    return response;
  }

  // ──── WHAT SHOULD I EAT NEXT ────
  if (q.includes("what should i eat") || q.includes("suggest food") || q.includes("next meal") || q.includes("kya khaun")) {
    const breakfastLogged = foods.some(f => f.meal === "breakfast");
    const lunchLogged = foods.some(f => f.meal === "lunch");
    const dinnerLogged = foods.some(f => f.meal === "dinner");

    if (!breakfastLogged && hr < 10) {
      return `for breakfast (after your run):\n\n🍌 Banana — 105 cal, quick energy\n🍵 Tea (less sugar) — 30 cal\n🥚 2 Boiled Eggs — 156 cal, 12.6g protein\n\nor if no eggs available:\n🫘 Chana/Dal — ~180-210 cal, 9-12g protein\n🥜 Handful of peanuts — 160 cal, 7g protein\n\ntotal: ~290-350 cal, 14-20g protein. perfect start! log it when you eat 👍`;
    }
    if (!lunchLogged && hr < 16) {
      return `for lunch, here's your ideal plate:\n\n🍚 Rice (moderate! don't fill the whole plate)\n🫘 Dal — ~180 cal, 9g protein\n🥘 Sabji — ~120 cal\n${totals.protein < 40 ? "🐟 Add fish or chicken if available — 22-25g protein boost!" : ""}\n\nremember: more dal & sabji, less rice. that's the rule 😄\nshould be around 500-700 cal total.`;
    }
    if (!dinnerLogged) {
      return `for dinner, keep it clean:\n\n🫓 2 Roti — 240 cal, 7g protein\n🥘 Sabji — 120 cal\n🫘 Dal — 180 cal, 9g protein\n\ntotal: ~540 cal, 19g protein. simple, balanced, and you'll sleep well.\n\nremember — eat by 8:30 PM max, sleep by 10 PM! 🌙`;
    }
    return `looks like you've had all your main meals today! if you're still hungry, grab some curd (60 cal, 3g protein) or a small fruit. avoid anything oily or junky at this hour. your body needs clean fuel for recovery 💪`;
  }

  // ──── WORKOUT ────
  if (q.includes("workout") || q.includes("exercise") || q.includes("run") || q.includes("walk") || q.includes("review")) {
    if (totals.totalKm >= 8) return `bro ${totals.totalKm.toFixed(1)}km? that's INSANE today! 🔥 ${totals.steps.toLocaleString()} steps and ~${totals.caloriesOut} calories burned. your body did amazing work. now the important part — recovery. drink water, eat protein (eggs, dal, chicken), and don't skip dinner. also stretch before bed, and sleep by 10 PM. tomorrow maybe go lighter, your muscles need time to rebuild.`;
    if (totals.totalKm >= 4) return `solid effort — ${totals.totalKm.toFixed(1)}km (${totals.steps.toLocaleString()} steps) is really good! 🏃 you burned about ${totals.caloriesOut} cal. to keep improving, try mixing it up: some days do intervals (1 min fast, 2 min slow), some days do long slow runs. an evening walk is always great for digestion and mental health too.`;
    if (totals.totalKm > 0) return `${totals.totalKm.toFixed(1)}km done so far — it's a start! 👟 every bit counts yaar. if you can, try adding a 15-20 min walk after dinner tonight. walking after meals helps with digestion and blood sugar. even 3-4km total per day is better than nothing.`;
    if (hr < 8) return `haven't headed out for your morning run yet? no worries, still early! ☀️ but try to get it done before 7 AM while it's cool. even a 20-min jog of 2-3km will set the tone for your whole day. stretch first, hydrate, and go!`;
    return `no workout logged today 😕 i get it, rest days happen. but try to at least go for a short walk — even 15 minutes. it helps with mood, digestion, and keeping the habit alive. tomorrow let's aim for a proper session yeah? 💪`;
  }

  // ──── SLEEP ────
  if (q.includes("sleep") || q.includes("rest") || q.includes("tired") || q.includes("neend")) {
    if (sleep && sleep >= 7) return `${sleep.toFixed(1)} hours — good job! 😴 with your activity level (${totals.totalKm.toFixed(1)}km today), 7+ hours is exactly what you need. your muscles repair during deep sleep and your brain consolidates everything. stick to the 10 PM bedtime rule and you'll feel amazing.`;
    if (sleep) return `only ${sleep.toFixed(1)} hours? yaar that's not enough 😬 you need 7-8 hours, especially on days you work out. poor sleep = poor recovery = poor performance tomorrow. try this: no phone after 9:30 PM, dim the lights, and be in bed by 10. your body will thank you.`;
    return `sleep is literally the #1 recovery tool. you said you'll sleep by 10 PM — that's perfect if you do it consistently. 7-8 hours of sleep helps your muscles recover, keeps hunger hormones balanced, and keeps you sharp. set an alarm for 9:30 PM to start winding down!`;
  }

  // ──── IMPROVEMENT ────
  if (q.includes("improve") || q.includes("better") || q.includes("suggest") || q.includes("advice") || q.includes("tip") || q.includes("help")) {
    const tips: string[] = [];
    if (totals.waterMl < 2000) tips.push("💧 drink more water — you're at " + (totals.waterMl/1000).toFixed(1) + "L, need 2.5L");
    if (totals.steps < 8000) tips.push("👟 try to hit 10k steps — add a post-dinner walk");
    if (totals.protein < 55) tips.push("🥚 boost protein — add eggs, chicken/fish, or extra dal");
    if (totals.caloriesIn === 0 && hr > 9) tips.push("🍽️ log your meals! can't help if i can't see what you're eating");
    if (totals.caloriesIn > 2300) tips.push("⚠️ watch the calories — probably too much rice today");
    if (workoutCount === 0 && hr > 8) tips.push("🏃 get some movement in — even a short walk counts");
    if (tips.length === 0) tips.push("✨ honestly? you're doing great today. just keep it consistent");
    
    return `here's what i'd focus on right now:\n\n${tips.join("\n")}\n\nremember your rules:\n• moderate rice, more dal & sabji\n• less junk/oily food\n• keep drinking water\n• sleep by 10 PM\n\nsmall consistent improvements > big random changes. you got this! 🔥`;
  }

  // ──── HOW AM I DOING (general) ────
  const score = Math.round(
    Math.min(100, (totals.steps / 10000) * 100) * 0.2 +
    Math.min(100, (totals.waterMl / 2500) * 100) * 0.2 +
    Math.min(100, (totals.totalKm / 8) * 100) * 0.2 +
    Math.min(100, (totals.protein / 80) * 100) * 0.2 +
    (workoutCount > 0 ? 100 : 0) * 0.2
  );
  
  const g = score >= 85 ? "killing it! 🏆" : score >= 70 ? "doing well! 💚" : score >= 50 ? "okay, but room to improve ⚡" : "let's step it up today 💪";
  
  let response = `alright, here's your honest check-in:\n\n${g} your day score: ${score}/100\n\n`;
  response += `🏃 Activity: ${totals.totalKm.toFixed(1)}km / ${totals.steps.toLocaleString()} steps`;
  response += totals.totalKm >= 5 ? " ✅\n" : totals.totalKm > 0 ? " 🔸\n" : " ❌\n";
  response += `🍽️ Food: ${totals.caloriesIn} cal / ${totals.protein}g protein`;
  response += totals.protein >= 60 ? " ✅\n" : totals.caloriesIn > 0 ? " 🔸\n" : " ❌\n";
  response += `💧 Water: ${(totals.waterMl/1000).toFixed(1)}L / 2.5L`;
  response += totals.waterMl >= 2000 ? " ✅\n" : totals.waterMl > 0 ? " 🔸\n" : " ❌\n";
  response += `💪 Workouts: ${workoutCount} session${workoutCount !== 1 ? "s" : ""}`;
  response += workoutCount > 0 ? " ✅\n" : " ❌\n";
  
  if (score >= 75) response += `\nyou're on track. keep doing what you're doing and don't forget water & sleep by 10!`;
  else if (score >= 50) response += `\nnot bad, but let's push it. log your meals, drink more water, and get some movement in.`;
  else response += `\nwe gotta work on this. start with water, log your food, and try to get at least a short walk in.`;
  
  return response;
}

// ──── Notification generator ────
function generateNotification(
  event: string, totals: Totals, _workoutCount: number, foods: FoodItem[]
): { text: string; type: "success" | "warning" | "info" | "alert" } | null {
  
  if (event === "workout") {
    const w = totals;
    if (w.totalKm >= 10) return { text: `🔥 wow ${w.totalKm.toFixed(1)}km today! that's beast mode. make sure you refuel — you need protein and water now.`, type: "success" };
    if (w.totalKm >= 5) return { text: `nice run! ${w.totalKm.toFixed(1)}km logged (${w.steps.toLocaleString()} steps). don't forget to eat your post-workout meal — banana + eggs + tea 🍌`, type: "success" };
    if (w.totalKm > 0) return { text: `${w.totalKm.toFixed(1)}km added! ${w.steps.toLocaleString()} steps so far. ${w.waterMl < 1000 ? "you need more water though — grab your bottle! 💧" : "keep going 👟"}`, type: "info" };
    return null;
  }
  
  if (event === "food") {
    const lastFood = foods[foods.length - 1];
    if (!lastFood) return null;
    
    const warnings: string[] = [];
    if (lastFood.name.toLowerCase().includes("rice") && lastFood.carbs > 50) {
      warnings.push("easy on the rice portion 🍚");
    }
    
    if (totals.caloriesIn > 2200) return { text: `heads up — you're at ${totals.caloriesIn} cal now. that's over 2200. watch the portions for the rest of today. ${warnings.join(" ")}`, type: "warning" };
    if (totals.protein >= 70 && totals.caloriesIn >= 1500) return { text: `${lastFood.name} logged ✅ nutrition looking solid — ${totals.caloriesIn} cal, ${totals.protein}g protein. your body's getting what it needs! 💪`, type: "success" };
    if (totals.protein < 30 && foods.length >= 2) return { text: `${lastFood.name} added. but your protein is only ${totals.protein}g with ${foods.length} meals logged — you need more. try eggs, chicken, fish, or extra dal.`, type: "warning" };
    return { text: `${lastFood.name} logged! ${totals.caloriesIn} cal total today, ${totals.protein}g protein. ${warnings.length > 0 ? warnings.join(" ") : "keep it balanced 🍽️"}`, type: "info" };
  }
  
  if (event === "water") {
    if (totals.waterMl >= 2500) return { text: `💧 ${(totals.waterMl/1000).toFixed(1)}L — you hit the 2.5L goal! amazing. your body is properly hydrated. 🎉`, type: "success" };
    if (totals.waterMl >= 1500) return { text: `good, ${(totals.waterMl/1000).toFixed(1)}L now. ${((2500 - totals.waterMl)/1000).toFixed(1)}L more to hit the goal. you're getting there! 💧`, type: "info" };
    if (totals.waterMl < 500 && totals.totalKm > 0) return { text: `only ${totals.waterMl}ml after working out ${totals.totalKm.toFixed(1)}km?? you need way more water right now. seriously, drink up! 🚨`, type: "alert" };
    return { text: `+water logged! ${(totals.waterMl/1000).toFixed(1)}L total. ${totals.waterMl < 1000 ? "keep drinking, you need more!" : "on track 👍"}`, type: "info" };
  }
  
  return null;
}

export default function AICoach({
  totals, workoutCount, foodCount, foods, sleep, isOpen, onToggle, notification
}: {
  totals: Totals; workoutCount: number; foodCount: number; foods: FoodItem[];
  sleep?: number; isOpen: boolean; onToggle: () => void;
  notification?: string | null;
}) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [typingMsgId, setTypingMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: string } | null>(null);
  const prevNotifRef = useRef<string | null>(null);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      const hr = new Date().getHours();
      const greeting = hr < 12
        ? `hey good morning! ☀️ i'm your health coach. i know your diet plan — banana, tea, eggs after your run in the morning, moderate rice with dal & sabji for lunch, 2 roti + sabji + dal at night.\n\ni'll track everything you log and give you real-time feedback. if you're slacking on water or eating too much rice, i'll let you know 😄\n\nlog your first activity and let's get this day going! 💪`
        : `hey! 👋 i'm your health coach. i've got your full diet and fitness plan locked in. i'll watch your logs — water, food, workouts — and tell you honestly how you're doing.\n\nask me anything or just start logging and i'll give you automatic feedback on everything! let's make today count 🔥`;
      addCoachMessage(greeting);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle incoming notifications from App
  useEffect(() => {
    if (notification && notification !== prevNotifRef.current) {
      prevNotifRef.current = notification;
      const notif = generateNotification(notification, totals, workoutCount, foods);
      if (notif) {
        // Show toast
        setToastMsg(notif);
        setTimeout(() => setToastMsg(null), 5000);
        
        // Add to chat
        const id = Math.random().toString(36).slice(2, 9);
        const msg: CoachMessage = {
          id, role: "notification", text: notif.text, type: notif.type,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
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
    const msg: CoachMessage = { id, role: "coach", text, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages(prev => [...prev, msg]);
    setTypingMsgId(id);
  }, []);

  const handleSend = (text?: string) => {
    const query = text || input.trim();
    if (!query) return;
    const userMsg: CoachMessage = { id: Math.random().toString(36).slice(2, 9), role: "user", text: query, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTimeout(() => {
      const response = generateCoachResponse(query, totals, workoutCount, foods, sleep);
      addCoachMessage(response);
    }, 500 + Math.random() * 700);
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
    if (totals.caloriesIn > 2200) ins.push({ icon: <span>🔸</span>, text: "Over calorie limit", color: "text-orange-400" });
    return ins;
  }, [totals, workoutCount, foodCount]);

  // ──── TOAST NOTIFICATION (always visible) ────
  const toast = toastMsg && (
    <div className={`fixed top-4 right-4 z-[60] max-w-sm anim-fade-down`}>
      <div className={`relative overflow-hidden rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
        toastMsg.type === "success" ? "border-emerald-500/30 bg-emerald-950/90 text-emerald-200" :
        toastMsg.type === "warning" ? "border-amber-500/30 bg-amber-950/90 text-amber-200" :
        toastMsg.type === "alert" ? "border-red-500/30 bg-red-950/90 text-red-200" :
        "border-purple-500/30 bg-purple-950/90 text-purple-200"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 mt-0.5 ${
            toastMsg.type === "success" ? "text-emerald-400" :
            toastMsg.type === "warning" ? "text-amber-400" :
            toastMsg.type === "alert" ? "text-red-400" : "text-purple-400"
          }`}>
            {toastMsg.type === "alert" ? <AlertTriangle className="h-5 w-5 anim-float" /> : <Bot className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">Coach Feedback</div>
            <p className="text-[12px] leading-[1.5]">{toastMsg.text}</p>
          </div>
          <button onClick={() => setToastMsg(null)} className="flex-shrink-0 opacity-50 hover:opacity-100 transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-white/20 w-full">
          <div className="h-full bg-white/40" style={{ animation: "shrink 5s linear forwards" }} />
        </div>
      </div>
    </div>
  );

  // ──── FAB (closed state) ────
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
          {/* Notification badge */}
          {toastMsg && (
            <span className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold animate-bounce">!</span>
          )}
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

          {/* Header */}
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
                  <p className="text-[11px] text-zinc-500">knows your diet • tracks your day</p>
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
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto px-4 py-4" style={{ maxHeight: "360px" }}>
                {messages.map((msg, idx) => {
                  const isCoachTyping = msg.role === "coach" && msg.id === typingMsgId;
                  const textToShow = isCoachTyping ? displayedText : msg.text;

                  // Notification style
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
                            <Bot className="h-3 w-3" /> Coach Notification • {msg.timestamp}
                          </div>
                          {msg.text}
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

              {/* Quick prompts */}
              <div className="border-t border-white/5 px-4 py-2.5 flex-shrink-0">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {COACH_PRESETS.map((preset, i) => (
                    <button key={preset} onClick={() => handleSend(preset)} disabled={isTyping}
                      className="whitespace-nowrap rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-zinc-400 ring-1 ring-white/5 transition hover:bg-purple-500/15 hover:text-purple-300 hover:ring-purple-500/20 disabled:opacity-50 anim-fade-up"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >{preset}</button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="border-t border-white/5 px-4 py-3 flex-shrink-0">
                <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                  <input value={input} onChange={e => setInput(e.target.value)} placeholder="ask me anything..." disabled={isTyping}
                    className="flex-1 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-[12px] outline-none ring-1 ring-white/10 focus:ring-purple-500/40 transition placeholder:text-zinc-600 disabled:opacity-50"
                  />
                  <button type="submit" disabled={isTyping || !input.trim()}
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
