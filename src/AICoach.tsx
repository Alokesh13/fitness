```ts
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
  X,
  Check,
  Trash2
} from "lucide-react";

import { getCoachLine, getStrongCoachLine } from "./coachLines";

type Totals = {
  runKm: number;
  walkKm: number;
  totalKm: number;
  steps: number;
  caloriesOut: number;
  caloriesIn: number;
  waterMl: number;
  protein: number;
  sleepHrs: number;
  napHrs: number;
};

type FoodItem = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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
  "Help me improve"
];

const uid = () => Math.random().toString(36).slice(2, 9);

const timeNow = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

function generateNotification(
  event: string,
  totals: Totals,
  _wc: number,
  foods: FoodItem[]
) {

  if (event === "workout") {

    if (totals.totalKm >= 5) {
      return {
        text: `Amazing work! ${totals.totalKm.toFixed(
          1
        )}km (${totals.steps.toLocaleString()} steps)! ${getCoachLine(
          "praise"
        )} 💪🔥`,
        type: "success" as const
      };
    }

    if (totals.totalKm > 0) {

      const waterNote =
        totals.waterMl < 1000
          ? " — " + getCoachLine("lowWater").split(".")[0]
          : " keep going!";

      return {
        text: `${totals.totalKm.toFixed(1)}km done! 👟${waterNote}`,
        type: "info" as const
      };
    }

    return null;
  }

  if (event === "exercise") {
    return {
      text: `Great job exercising today! ${getCoachLine(
        "motivation"
      )} 💪🔥`,
      type: "success" as const
    };
  }

  if (event === "food") {

    const last = foods[foods.length - 1];

    if (!last) return null;

    if (totals.caloriesIn > 2200) {
      return {
        text: `${totals.caloriesIn} calories already? ${getCoachLine(
          "overEating"
        )} 🍚`,
        type: "alert" as const
      };
    }

    if (totals.protein < 30 && foods.length >= 2) {
      return {
        text: `${last.name} added! Protein still low at ${totals.protein}g. ${getCoachLine(
          "lowProtein"
        )} 🥚`,
        type: "warning" as const
      };
    }

    if (totals.protein >= 70 && totals.caloriesIn >= 1500) {
      return {
        text: `Excellent nutrition today! ${totals.caloriesIn} cal and ${totals.protein}g protein. ${getCoachLine(
          "praise"
        )} 🙌🔥`,
        type: "success" as const
      };
    }

    return {
      text: `${last.name} added! Current total: ${totals.caloriesIn} calories 🍽️`,
      type: "info" as const
    };
  }

  if (event === "water") {

    if (totals.waterMl >= 2500) {
      return {
        text: `Hydration goal completed! ${getCoachLine(
          "waterGoal"
        )} 💧🎉`,
        type: "success" as const
      };
    }

    if (totals.waterMl >= 1500) {
      return {
        text: `Nice hydration progress! ${(totals.waterMl / 1000).toFixed(
          1
        )}L completed.`,
        type: "info" as const
      };
    }

    if (totals.waterMl > 0) {
      return {
        text: `${(totals.waterMl / 1000).toFixed(
          1
        )}L water only. ${getCoachLine("lowWater")}`,
        type: "warning" as const
      };
    }

    return {
      text: getStrongCoachLine("noWater"),
      type: "alert" as const
    };
  }

  if (event === "sleep") {
    return {
      text:
        totals.sleepHrs < 6
          ? getCoachLine("noSleep")
          : `Good sleep logged! ${getCoachLine("praise")}`,
      type: "success" as const
    };
  }

  return null;
}
```
