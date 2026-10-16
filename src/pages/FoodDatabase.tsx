import { useState } from "react";
import { useAppStore } from "../store/appStore";
import type { Food, FoodCategory } from "../types";

const emptyFood = (): Omit<Food, "id" | "createdAt" | "updatedAt"> => ({
  name: "",
  category: "custom",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  servingDescription: "1 serving (~100g)",
  servingGrams: 100,
  isApproximate: false,
  isCustom: true,
  source: "custom",
});

export function FoodDatabase() {
  const foods = useAppStore((s) => s.foods);
  const upsertFood = useAppStore((s) => s.upsertFood);
  const deleteFood = useAppStore((s) => s.deleteFood);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Food | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof emptyFood>>(emptyFood());
  const [showForm, setShowForm] = useState(false);

  const filtered = foods.filter((f) => {
    if (!q.trim()) return true;
    const qq = q.toLowerCase();
    return (
      f.name.toLowerCase().includes(qq) ||
      (f.localName?.toLowerCase().includes(qq) ?? false) ||
      (f.brand?.toLowerCase().includes(qq) ?? false) ||
      (f.aliases?.some((a) => a.toLowerCase().includes(qq)) ?? false)
    );
  });

  function openNew() {
    setEditing(null);
    setDraft(emptyFood());
    setShowForm(true);
  }

  function openEdit(f: Food) {
    setEditing(f);
    setDraft({
      name: f.name,
      localName: f.localName,
      category: f.category,
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      servingDescription: f.servingDescription,
      servingGrams: f.servingGrams,
      isApproximate: f.isApproximate,
      isCustom: true,
      source: f.source === "seed" ? "custom" : f.source,
    });
    setShowForm(true);
  }

  async function save() {
    if (!draft.name.trim()) return;
    const food: Food = {
      ...(editing || {}),
      id: editing ? editing.id : `custom-${Date.now()}`,
      name: draft.name.trim(),
      localName: draft.localName?.trim() || undefined,
      category: draft.category,
      calories: Number(draft.calories),
      protein: Number(draft.protein),
      carbs: Number(draft.carbs),
      fat: Number(draft.fat),
      servingDescription: draft.servingDescription,
      servingGrams: Number(draft.servingGrams) || 100,
      isApproximate: Boolean(draft.isApproximate),
      isCustom: true,
      source: editing ? editing.source : "custom",
      createdAt: editing ? editing.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
    // if editing a seed food, persist as custom override (same id)
    await upsertFood(food);
    setShowForm(false);
  }

  return (
    <div className="mx-auto max-w-[560px] p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">My Foods</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">Add, edit, delete your personal foods. Correcting an AI estimate here saves it for instant search next time. Seeded values are marked “approx, editable”.</p>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter foods..."
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button onClick={openNew} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">+ New Food</button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 space-y-3">
          <h2 className="text-sm font-semibold">{editing ? `Edit: ${editing.name}` : "New Food"}</h2>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name (e.g. My Sambar)" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input value={draft.localName || ""} onChange={(e) => setDraft({ ...draft, localName: e.target.value })} placeholder="Local name (optional)" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Category
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as FoodCategory })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                <option value="south_indian">South Indian</option>
                <option value="north_indian">North Indian</option>
                <option value="branded">Branded</option>
                <option value="international">International</option>
                <option value="staple">Staple</option>
                <option value="ingredient">Ingredient</option>
                <option value="snack">Snack</option>
                <option value="beverage">Beverage</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="text-xs">Serving grams
              <input type="number" value={draft.servingGrams} onChange={(e) => setDraft({ ...draft, servingGrams: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
            </label>
          </div>
          <input value={draft.servingDescription} onChange={(e) => setDraft({ ...draft, servingDescription: e.target.value })} placeholder="Serving description (e.g. 1 katori (~150g))" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <div className="grid grid-cols-4 gap-2">
            <label className="text-xs">kcal<input type="number" value={draft.calories} onChange={(e) => setDraft({ ...draft, calories: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
            <label className="text-xs">Protein<input type="number" value={draft.protein} onChange={(e) => setDraft({ ...draft, protein: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
            <label className="text-xs">Carbs<input type="number" value={draft.carbs} onChange={(e) => setDraft({ ...draft, carbs: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
            <label className="text-xs">Fat<input type="number" value={draft.fat} onChange={(e) => setDraft({ ...draft, fat: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isApproximate} onChange={(e) => setDraft({ ...draft, isApproximate: e.target.checked })} /> Approximate, editable</label>
          <div className="flex gap-2">
            <button onClick={save} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white">Save</button>
            <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm dark:border-slate-700">Cancel</button>
          </div>
          <p className="text-xs text-slate-500">Tip: Correct any AI estimate by editing the saved food — next search will be instant and local-first.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.slice(0, 200).map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{f.name}</span>
                {f.brand && <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">{f.brand}</span>}
                {f.dietaryPreference === "non_veg" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-800 dark:bg-red-900/40 dark:text-red-200">non-veg</span>}
                {f.isApproximate && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">approx</span>}
                {f.source !== "seed" && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-800">{f.source}</span>}
              </div>
              {f.localName && <div className="text-[11px] text-slate-400 dark:text-slate-500">{f.localName}</div>}
              <div className="truncate text-xs text-slate-500 mt-0.5">{f.servingDescription} · {Math.round(f.calories)} kcal · P {f.protein} C {f.carbs} F {f.fat} · {f.category}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => openEdit(f)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">Edit</button>
              <button onClick={() => deleteFood(f.id)} className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 dark:bg-red-950/30">Delete</button>
            </div>
          </div>
        ))}
        <p className="text-center text-xs text-slate-500 py-4">Showing {Math.min(200, filtered.length)} of {filtered.length} foods</p>
      </div>
    </div>
  );
}
