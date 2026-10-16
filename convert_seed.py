import json, sys
from pathlib import Path

src = r'C:\Users\kkchi\AppData\Local\fitness-app-output\telugu_food_database_seed.json'
foods = json.load(open(src, encoding="utf-8"))

def esc(s):
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")

def fmt(v, indent):
    if isinstance(v, str):
        return f"'{esc(v)}'"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float):
        if v.is_integer():
            return f"{int(v)}.0"
        return repr(v)
    if isinstance(v, int):
        return str(v)
    if v is None:
        return "undefined"
    return str(v)

out = []
out.append("// AUTO-GENERATED from Python seed generator (1,500 Telugu-first South Indian foods).")
out.append("// All seeded values are approximate, marked isApproximate=true, source='seed'.")
out.append("// Nutrients are for servingGrams. Serving sizes included in servingDescription.")
out.append("import type { Food } from '../types'")
out.append("")
out.append("export const SEED_FOODS: Food[] = [")

for f in foods:
    lines = []
    lines.append("  {")
    for key in ["id","name","localName","category","calories","protein","carbs","fat","fiber","servingDescription","servingGrams","isApproximate","isCustom","source","createdAt","updatedAt"]:
        if key in f:
            lines.append(f"    {key}: {fmt(f[key], 4)},")
        else:
            if key == "fiber":
                lines.append(f"    {key}: undefined,")
            elif key == "localName":
                lines.append(f"    {key}: undefined,")
    # remove trailing comma after last property to avoid oxlint complaining (TS allows but keep clean)
    lines[-1] = lines[-1].rstrip().rstrip(",")
    lines.append("  },")
    out.append("\n".join(lines))

out.append("];")
out.append("")
out.append(f"// Count: {len(foods)}\n")

text = "\n".join(out)
# write to project src/data/seedFoods.ts
dest = Path(r"C:\Users\kkchi\fitness-app\src\data\seedFoods.ts")
dest.write_text(text, encoding="utf-8")
print("written", dest, len(foods))
