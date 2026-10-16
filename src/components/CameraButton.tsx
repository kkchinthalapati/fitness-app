import { useRef, useState } from "react";
import { estimateFromImage } from "../services/gemini";
import type { Food } from "../types";
import { useAppStore } from "../store/appStore";

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({ base64, mime: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CameraButton({ onEstimate }: { onEstimate: (food: Food) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLabel, setIsLabel] = useState(false);
  const upsertFood = useAppStore((s) => s.upsertFood);
  const plateRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File, labelMode: boolean) {
    setLoading(true);
    setError(null);
    try {
      const { base64, mime } = await fileToBase64(file);
      const est = await estimateFromImage(base64, mime, undefined, labelMode);
      const food: Food = {
        id: `ai-${Date.now()}`,
        name: est.foodName,
        category: "custom",
        calories: est.calories,
        protein: est.protein,
        carbs: est.carbs,
        fat: est.fat,
        servingDescription: est.servingDescription,
        servingGrams: est.servingGrams,
        isApproximate: est.confidence !== "high",
        isCustom: true,
        source: "ai",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await upsertFood(food);
      onEstimate(food);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Camera</span>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={isLabel} onChange={(e) => setIsLabel(e.target.checked)} />
          <span className="text-slate-600 dark:text-slate-300">Nutrition label mode</span>
        </label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => plateRef.current?.click()}
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {loading ? "Analyzing..." : "📷 Take / Upload Photo"}
        </button>
        <button
          onClick={() => labelRef.current?.click()}
          disabled={loading}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          Scan Label
        </button>
      </div>
      <input
        ref={plateRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f, isLabel);
          e.target.value = "";
        }}
      />
      <input
        ref={labelRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f, true);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400 break-words">{error}</p>}
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Uses Gemini vision. For labels, values are extracted; for plates, estimated. Check API key in Settings.</p>
    </div>
  );
}
