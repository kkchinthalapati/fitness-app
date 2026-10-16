import re
import json

with open("src/data/seedFoods.ts", "r", encoding="utf-8") as f:
    content = f.read()

raw_objs = re.findall(r"\{\s*(id:\s*'[^']+'[\s\S]*?)\n\s*\},", content)
print(f"Total raw objects found: {len(raw_objs)}")

foods = []
for ro in raw_objs:
    d = {}
    for line in ro.split("\n"):
        line = line.strip().rstrip(",")
        if not line or ":" not in line:
            continue
        k, v = line.split(":", 1)
        k = k.strip()
        v = v.strip()
        if v.startswith("'") and v.endswith("'"):
            d[k] = v[1:-1]
        elif v == "undefined":
            d[k] = None
        elif v == "true":
            d[k] = True
        elif v == "false":
            d[k] = False
        else:
            try:
                d[k] = float(v)
            except:
                d[k] = v
    foods.append(d)

print(f"Successfully parsed {len(foods)} foods")

# 1. Macro consistency check
macro_mismatch = []
physically_impossible = []
serving_gram_anomalies = []
per_100g_not_scaled = []

for f in foods:
    cal = f.get("calories", 0)
    p = f.get("protein", 0)
    c = f.get("carbs", 0)
    fat = f.get("fat", 0)
    fib = f.get("fiber", 0) or 0
    sg = f.get("servingGrams", 100)
    desc = f.get("servingDescription", "")
    name = f.get("name", "")

    # Check 1: 4*P + 4*C + 9*F
    expected_cal = 4 * p + 4 * c + 9 * fat
    diff = abs(cal - expected_cal)
    if diff > 25 and (diff / max(cal, 1)) > 0.20:
        macro_mismatch.append((name, desc, sg, cal, round(expected_cal, 1), round(diff, 1)))

    # Check 2: Sum of macros > servingGrams
    if (p + c + fat) > sg * 1.05:
        physically_impossible.append((name, desc, sg, round(p + c + fat, 1)))

    # Check 3: Portion size vs servingGrams sanity
    # For example, "1 piece (~40g)" but servingGrams is 150
    m_gram = re.search(r"~(\d+)\s*g", desc)
    if m_gram:
        desc_g = float(m_gram.group(1))
        if abs(desc_g - sg) > 5:
            serving_gram_anomalies.append((name, desc, sg, desc_g))

print(f"Macro calorie mismatches (>20% and >25 kcal): {len(macro_mismatch)}")
print(f"Physically impossible (P+C+F > servingGrams): {len(physically_impossible)}")
print(f"Description grams != servingGrams: {len(serving_gram_anomalies)}")

if macro_mismatch:
    print("\nSample Macro Calorie Mismatches:")
    for m in macro_mismatch[:10]:
        print(f"  {m[0]} | {m[1]} | listed {m[3]} kcal vs 4P+4C+9F {m[4]} kcal (diff {m[5]})")

if physically_impossible:
    print("\nSample Physically Impossible:")
    for pi in physically_impossible[:10]:
        print(f"  {pi[0]} | {pi[1]} | servingGrams={pi[2]} but P+C+F={pi[3]}g")

if serving_gram_anomalies:
    print("\nSample Serving Gram Anomalies:")
    for sga in serving_gram_anomalies[:10]:
        print(f"  {sga[0]} | desc='{sga[1]}' vs servingGrams={sga[2]}")
