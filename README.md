# Fitness App — Private Calorie Tracker (Capacitor)

Local-first, private calorie tracker. All data in IndexedDB on device. No account, no backend.

## Quick start (web)

```bash
cd fitness-app
npm install
npm run dev
# http://localhost:5173
```

## Build a debug APK (Android)

Requires: Android Studio + JDK 17+, Android SDK.

```bash
npm run build
npx cap add android        # first time only — creates android/
npx cap sync               # copies dist -> android
npx cap open android       # opens Android Studio
```

In Android Studio: Run → Select device/emulator → Run. Or build APK: Build → Build APK(s) (debug APK at `android/app/build/outputs/apk/debug/app-debug.apk`).

Tip: `npx cap copy` after each `npm run build` if you skip `sync`.

## Configuration

- **Gemini API key:** Settings tab → paste key (stored in localStorage, never committed). Or set `VITE_GEMINI_API_KEY` in `.env` at build time (see `.env.example`).
- **Model default:** `gemini-2.0-flash`. Editable in Settings. For vision (camera) use a flash model with vision support.
- **Goals:** Calories/protein/carbs/fat editable in Settings, persisted to IndexedDB.

## How to add a new food & correct an AI estimate

1. **Add:** Foods tab → `+ New Food` → fill name, serving description, serving grams, macros → Save. Or search for a name → if not found → `Estimate with AI` → auto-saved to Foods.
2. **Correct an AI estimate:** Foods tab → find the AI-saved entry (marked `ai`) → Edit → fix calories/macros/serving → Save. Next search matches your corrected local copy first (local-first ranking, custom foods ranked higher).

## Project structure

```
src/
  data/seedFoods.ts      # ~120 seeded foods: South/North Indian + staples + per-100g ingredients (isApproximate: true)
  db/index.ts            # IndexedDB (idb) — foods, entries (by-date), settings
  services/gemini.ts     # Gemini REST (JSON mode) — text estimate + vision (plate vs label)
  store/appStore.ts      # Zustand — hydrate, date navigation, search ranking
  components/            # FoodSearch, TotalsBar, CameraButton
  pages/ DailyLog, FoodDatabase, Settings
capacitor.config.ts      # appId com.fitness.app, webDir dist
```

## Notes

- Search is local-first; AI is fallback only when no match or user requests estimate.
- Camera: uses `<input capture="environment">` on web + Capacitor Camera on native. Supports plate and nutrition-label mode.
- Dark mode via `prefers-color-scheme`.
- Private APK: debug builds install directly; no Play Store needed.
