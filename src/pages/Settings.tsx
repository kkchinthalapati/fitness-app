import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { getDB } from "../db";

export function Settings() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [key, setKey] = useState(settings.geminiApiKey || "");
  const [model, setModel] = useState(settings.geminiModel || "gemini-2.0-flash");
  const [calGoal, setCalGoal] = useState(String(settings.calorieGoal));
  const [pGoal, setPGoal] = useState(String(settings.proteinGoal));
  const [cGoal, setCGoal] = useState(String(settings.carbsGoal));
  const [fGoal, setFGoal] = useState(String(settings.fatGoal));
  const [saved, setSaved] = useState(false);

  async function save() {
    await updateSettings({
      geminiApiKey: key.trim(),
      geminiModel: model.trim() || "gemini-2.0-flash",
      calorieGoal: Number(calGoal) || 2000,
      proteinGoal: Number(pGoal) || 120,
      carbsGoal: Number(cGoal) || 250,
      fatGoal: Number(fGoal) || 65,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function clearData() {
    if (!confirm("Clear all daily entries? Foods and settings will be kept.")) return;
    const db = await getDB();
    await db.clear("entries");
    location.reload();
  }

  return (
    <div className="mx-auto max-w-[560px] p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Goals</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs">Calorie goal (kcal)
            <input value={calGoal} onChange={(e) => setCalGoal(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="text-xs">Protein (g)
            <input value={pGoal} onChange={(e) => setPGoal(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="text-xs">Carbs (g)
            <input value={cGoal} onChange={(e) => setCGoal(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="text-xs">Fat (g)
            <input value={fGoal} onChange={(e) => setFGoal(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Gemini AI</h2>
        <p className="text-xs text-slate-500">Your key is stored locally on device (localStorage + IndexedDB). Never hardcoded. Create one at aistudio.google.com.</p>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIza... (Gemini API key)"
          type="password"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <label className="block text-xs">Model
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gemini-2.0-flash" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
        </label>
        <p className="text-xs text-slate-500">Used for text fallback and photo estimation. Responses are forced to JSON. Errors are shown inline where you invoked AI.</p>
      </div>

      <button onClick={save} className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white">
        {saved ? "✓ Saved" : "Save Settings"}
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold">How to add / correct foods</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
          <li><b>Add:</b> My Foods → + New Food → fill serving + macros → Save. Or search → AI estimate → auto-saved to My Foods.</li>
          <li><b>Correct AI estimate:</b> My Foods → find the AI-saved food → Edit → fix values → Save. Next search hits your corrected local copy instantly (local-first search).</li>
          <li><b>Privacy:</b> Everything stays in IndexedDB on device. No account, no backend.</li>
        </ol>
      </div>

      <button onClick={clearData} className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
        Clear All Daily Entries
      </button>

      <p className="text-center text-xs text-slate-400">fitness-app · local-first · Capacitor-ready</p>
    </div>
  );
}
