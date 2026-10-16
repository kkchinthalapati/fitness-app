import { useState, useMemo } from "react";
import { useAppStore } from "../store/appStore";
import { parseQuickLogText, type ParsedQuickLogItem } from "../utils/quickLogParser";
import type { MealType } from "../types";
import { MEAL_LABELS } from "../types";

const QUICK_EXAMPLES = [
  "2 idli with 1 ladle sambar and 1 tsp ghee",
  "3 chapati + 1 katori dal + 1 tbsp curd",
  "1 glass milk and 8 almonds",
  "1.5 cup rice with 1 ladle pappu",
];

export function QuickLogBox({ defaultMeal = "lunch" }: { defaultMeal?: MealType }) {
  const searchFoods = useAppStore((s) => s.searchFoods);
  const quickLogText = useAppStore((s) => s.quickLogText);

  const [text, setText] = useState("");
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [loggedCount, setLoggedCount] = useState<number | null>(null);
  const [isLogging, setIsLogging] = useState(false);

  // Live zero-latency preview
  const parsedItems: ParsedQuickLogItem[] = useMemo(() => {
    if (!text.trim()) return [];
    return parseQuickLogText(text, (q) => searchFoods(q, { vegOnly: false }));
  }, [text, searchFoods]);

  const matchedCount = parsedItems.filter((i) => i.matchedFood !== null).length;
  const totalCalories = parsedItems.reduce((acc, i) => acc + i.calories, 0);

  async function handleLog() {
    if (!text.trim() || matchedCount === 0) return;
    setIsLogging(true);
    try {
      const results = await quickLogText(text, meal);
      const count = results.filter((r) => r.matchedFood).length;
      setLoggedCount(count);
      setText("");
      setTimeout(() => setLoggedCount(null), 3000);
    } finally {
      setIsLogging(false);
    }
  }

  return (
    <div className="rounded-3xl border border-violet-200 bg-gradient-to-b from-violet-50/70 to-white p-5 shadow-sm dark:border-violet-900/50 dark:from-violet-950/20 dark:to-slate-900 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-600 text-sm text-white shadow-sm">
            ⚡
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Multi-Item Quick Log
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Zero latency parser · Log your entire plate in 1 sentence
            </p>
          </div>
        </div>
        <select
          value={meal}
          onChange={(e) => setMeal(e.target.value as MealType)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-sm"
        >
          {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => (
            <option key={m} value={m}>
              {MEAL_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {/* Text Area */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder='Type natural text, e.g. "2 idli with 1 ladle sambar and 1 tsp ghee"...'
          className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 shadow-inner"
        />
      </div>

      {/* Quick Example Chips */}
      {!text && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-[11px] text-slate-400 py-1">Try:</span>
          {QUICK_EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setText(ex)}
              className="rounded-full border border-violet-100 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:border-violet-300 dark:border-slate-800 dark:bg-slate-800 dark:text-violet-300 transition"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Success Notification */}
      {loggedCount !== null && (
        <div className="rounded-xl bg-emerald-100 p-2.5 text-center text-xs font-semibold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 animate-fadeIn">
          ✓ Successfully logged {loggedCount} items to {MEAL_LABELS[meal]}!
        </div>
      )}

      {/* Live Recognized Items Preview */}
      {parsedItems.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 animate-fadeIn">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Recognized Items ({matchedCount}/{parsedItems.length})</span>
            <span className="text-violet-600 dark:text-violet-400">Total: ~{Math.round(totalCalories)} kcal</span>
          </div>

          <div className="space-y-1.5">
            {parsedItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {item.quantity} {item.unit}
                    </span>
                    <span className="truncate text-slate-700 dark:text-slate-300">
                      {item.matchedFood ? item.matchedFood.name : `"${item.query}"`}
                    </span>
                    {item.matchedFood ? (
                      <span className="rounded-md bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        matched
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        not found
                      </span>
                    )}
                  </div>
                  {item.matchedFood && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      P {item.protein.toFixed(1)}g · C {item.carbs.toFixed(1)}g · F {item.fat.toFixed(1)}g · {Math.round(item.grams)}g
                    </div>
                  )}
                </div>
                <div className="text-right font-bold text-slate-900 dark:text-white pl-2">
                  {Math.round(item.calories)} kcal
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleLog}
            disabled={matchedCount === 0 || isLogging}
            className="mt-2 w-full rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-700 disabled:opacity-50 transition"
          >
            {isLogging ? "Logging..." : `⚡ Quick Log All ${matchedCount} Items to ${MEAL_LABELS[meal]}`}
          </button>
        </div>
      )}
    </div>
  );
}
