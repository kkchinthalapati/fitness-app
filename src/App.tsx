import { useEffect } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { DailyLog } from "./pages/DailyLog";
import { FoodDatabase } from "./pages/FoodDatabase";
import { Settings } from "./pages/Settings";
import { useAppStore } from "./store/appStore";

function Shell() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading fitness-app...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Routes>
        <Route path="/" element={<DailyLog />} />
        <Route path="/foods" element={<FoodDatabase />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-[560px] items-center justify-around px-2 py-2">
          <NavLink to="/" className={({ isActive }) => `flex flex-col items-center rounded-xl px-6 py-2 text-xs font-medium ${isActive ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 dark:text-slate-400"}`}>
            <span className="text-base">◯</span> Log
          </NavLink>
          <NavLink to="/foods" className={({ isActive }) => `flex flex-col items-center rounded-xl px-6 py-2 text-xs font-medium ${isActive ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 dark:text-slate-400"}`}>
            <span className="text-base">≡</span> Foods
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `flex flex-col items-center rounded-xl px-6 py-2 text-xs font-medium ${isActive ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 dark:text-slate-400"}`}>
            <span className="text-base">⚙</span> Settings
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
