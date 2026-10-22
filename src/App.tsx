import { useEffect } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { DailyLog } from "./pages/DailyLog";
import { FoodDatabase } from "./pages/FoodDatabase";
import { NutritionAnalysis } from "./pages/NutritionAnalysis";
import { Recipes } from "./pages/Recipes";
import { Settings } from "./pages/Settings";
import { Trends } from "./pages/Trends";
import { WorkoutsPage } from "./pages/WorkoutsPage";
import { useAppStore } from "./store/appStore";

function Shell() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Sync theme to documentElement classList
  useEffect(() => {
    const root = document.documentElement;
    const theme = settings.theme || "system";

    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.remove("dark", "light");
      if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      }
    }
  }, [settings.theme]);

  function handleCycleTheme() {
    const cur = settings.theme || "system";
    const next = cur === "system" ? "dark" : cur === "dark" ? "light" : "system";
    updateSettings({ theme: next });
  }

  const themeIcon = settings.theme === "dark" ? "🌙" : settings.theme === "light" ? "☀️" : "🌓";
  const themeLabel = settings.theme === "dark" ? "Dark" : settings.theme === "light" ? "Light" : "Auto";

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500 font-medium">
        Loading fitness-app...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* Desktop Top Navigation Bar */}
      <header className="sticky top-0 z-40 hidden md:block border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-600 text-xs text-white shadow-sm font-black">
              ⚡
            </span>
            <span className="text-sm font-black tracking-tight">Fitness App</span>
          </NavLink>

          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <span>📋</span> Log
            </NavLink>
            <NavLink
              to="/workouts"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <span>⚡</span> Workouts
            </NavLink>
            <NavLink
              to="/recipes"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <span>🍲</span> Recipes
            </NavLink>
            <NavLink
              to="/nutrition"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <span>🔬</span> Nutrients
            </NavLink>
            <NavLink
              to="/trends"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <span>📈</span> Trends
            </NavLink>
            <NavLink
              to="/foods"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <span>🥗</span> Foods
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <span>⚙</span> Settings
            </NavLink>

            {/* Theme Toggle Button */}
            <button
              onClick={handleCycleTheme}
              className="ml-2 flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/70 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition"
              title={`Current Theme: ${themeLabel}. Click to switch.`}
            >
              <span>{themeIcon}</span>
              <span className="text-[11px]">{themeLabel}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Top Header Bar */}
      <header className="sticky top-0 z-40 block md:hidden border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex items-center justify-between px-3 py-2">
          <NavLink to="/" className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600 text-xs text-white shadow-sm font-black">
              ⚡
            </span>
            <span className="text-xs font-black tracking-tight">Fitness App</span>
          </NavLink>

          <div className="flex items-center gap-1">
            <NavLink
              to="/foods"
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Food Database"
            >
              🥗 Foods
            </NavLink>
            <button
              onClick={handleCycleTheme}
              className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title={`Current: ${themeLabel}`}
            >
              {themeIcon}
            </button>
            <NavLink
              to="/settings"
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Settings"
            >
              ⚙
            </NavLink>
          </div>
        </div>
      </header>

      <main className="mx-auto">
        <Routes>
          <Route path="/" element={<DailyLog />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/nutrition" element={<NutritionAnalysis />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/foods" element={<FoodDatabase />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation Bar (5 Primary Tabs: generous touch targets without text truncation) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
        <div className="mx-auto grid max-w-[500px] grid-cols-5 items-center px-1 py-1 text-center">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center rounded-xl py-1 px-1 text-[11px] font-bold transition min-h-[44px] ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <span className="text-sm leading-none">📋</span>
            <span className="leading-tight mt-0.5">Diary</span>
          </NavLink>
          <NavLink
            to="/workouts"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center rounded-xl py-1 px-1 text-[11px] font-bold transition min-h-[44px] ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <span className="text-sm leading-none">⚡</span>
            <span className="leading-tight mt-0.5">Workouts</span>
          </NavLink>
          <NavLink
            to="/recipes"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center rounded-xl py-1 px-1 text-[11px] font-bold transition min-h-[44px] ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <span className="text-sm leading-none">🍲</span>
            <span className="leading-tight mt-0.5">Recipes</span>
          </NavLink>
          <NavLink
            to="/nutrition"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center rounded-xl py-1 px-1 text-[11px] font-bold transition min-h-[44px] ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <span className="text-sm leading-none">🔬</span>
            <span className="leading-tight mt-0.5">Nutrients</span>
          </NavLink>
          <NavLink
            to="/trends"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center rounded-xl py-1 px-1 text-[11px] font-bold transition min-h-[44px] ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <span className="text-sm leading-none">📈</span>
            <span className="leading-tight mt-0.5">Trends</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
