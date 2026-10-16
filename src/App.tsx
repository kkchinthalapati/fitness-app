import { useEffect } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { DailyLog } from "./pages/DailyLog";
import { FoodDatabase } from "./pages/FoodDatabase";
import { Settings } from "./pages/Settings";
import { Trends } from "./pages/Trends";
import { useAppStore } from "./store/appStore";

function Shell() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500 font-medium">
        Loading fitness-app...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Routes>
        <Route path="/" element={<DailyLog />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/foods" element={<FoodDatabase />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-[560px] items-center justify-around px-2 py-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center rounded-xl px-4 py-1.5 text-xs font-bold transition ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <span className="text-sm">◯</span> Log
          </NavLink>
          <NavLink
            to="/trends"
            className={({ isActive }) =>
              `flex flex-col items-center rounded-xl px-4 py-1.5 text-xs font-bold transition ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <span className="text-sm">📈</span> Trends
          </NavLink>
          <NavLink
            to="/foods"
            className={({ isActive }) =>
              `flex flex-col items-center rounded-xl px-4 py-1.5 text-xs font-bold transition ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <span className="text-sm">≡</span> Foods
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex flex-col items-center rounded-xl px-4 py-1.5 text-xs font-bold transition ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <span className="text-sm">⚙</span> Settings
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
