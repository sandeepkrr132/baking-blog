"""AI recipe-text cleanup for the baking blog.

Reads every recipe in recipes.json (title + ingredients + steps), asks Kimi
Moonshot to (1) write a proper 1-2 sentence description (fixing the boilerplate
"A classic X recipe: title" descriptions) and (2) flag ingredient/step issues
(missing amounts, steps referencing unlisted ingredients, implausible times).

Writes NO data to the DB. It only produces suggestions the admin approves via
the create-recipe.html edit page.

Outputs:
  ai-suggestions.json        { slug: { title, description, issues: [...] } }
  ai-cleanup-suggestions.jsonl  per-recipe checkpoint (one JSON line per recipe)
  ai-cleanup-report.md       human-readable review summary

Usage:
  python ai-cleanup-recipes.py                 # all recipes, 4 workers, resume-aware
  python ai-cleanup-recipes.py --limit 5       # test on first 5
  python ai-cleanup-recipes.py --slugs a,b,c   # only these slugs
  python ai-cleanup-recipes.py --retry         # re-run failures / no-description
"""
import argparse, concurrent.futures, json, os, re, sys, time, urllib.error, urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
RECIPES_JSON = os.path.join(BASE, "recipes.json")
OUT_JSONL = os.path.join(BASE, "ai-cleanup-suggestions.jsonl")
OUT_JSON = os.path.join(BASE, "ai-suggestions.json")
OUT_REPORT = os.path.join(BASE, "ai-cleanup-report.md")

def load_env():
    """Load secrets from a local .env file (gitignored) into os.environ.
    Never commit .env — keep API keys out of git history."""
    env_path = os.path.join(BASE, ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

load_env()

KEY = os.environ.get("KIMI_API_KEY")  # required — set in .env or the environment
KIMI_URL = "https://api.moonshot.ai/v1/chat/completions"
KIMI_MODEL = os.environ.get("KIMI_MODEL", "moonshot-v1-32k-vision-preview")

PROMPT = """You are proofreading recipe content for a baking blog.

RECIPE TITLE: {title}
CATEGORY: {category}
PREP: {prep} min, COOK: {cook} min, SERVINGS: {servings}

INGREDIENTS:
{ingredients}

STEPS:
{steps}

Tasks:
1. Write a 1-2 sentence appetizing description for this recipe that names the
   dish and what makes it special. Do NOT start with "A classic ... recipe".
2. Check the recipe for data problems and list them, e.g.:
   - an ingredient missing an amount (only name, no "1 cup" etc.)
   - a step that references an ingredient not in the ingredients list
   - prep/cook time implausible for the method (a 90-min bake with cookTime=5)
   - obviously wrong/duplicated ingredient
   If there are no problems, return an empty list.

Reply with ONLY a JSON object, no markdown, no prose:
{{"description": "the rewritten description", "issues": ["issue 1", "issue 2"]}}"""


def load_recipes():
    with open(RECIPES_JSON, encoding="utf-8") as f:
        data = json.load(f)
    return data["recipes"] if isinstance(data, dict) and "recipes" in data else data


def load_done():
    done = {}
    if os.path.exists(OUT_JSONL):
        with open(OUT_JSONL, encoding="utf-8") as f:
            for line in f:
                try:
                    r = json.loads(line)
                    done[r["slug"]] = r
                except Exception:
                    pass
    return done


def purge_slugs(slugs):
    kept = {}
    for slug, r in load_done().items():
        if slug not in slugs:
            kept[slug] = r
    with open(OUT_JSONL, "w", encoding="utf-8") as f:
        for r in kept.values():
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return len(kept)


def format_list(items):
    if not items:
        return "(none)"
    if isinstance(items, list) and isinstance(items[0], dict):
        # [{"amount": "1 cup", "name": "flour"}]
        return "\n".join(f"- {it.get('amount', '?')} {it.get('name', '?')}".strip() for it in items)
    if isinstance(items, list):
        return "\n".join(f"- {it}" for it in items)
    return str(items)


def format_steps(steps):
    if not steps:
        return "(none)"
    out = []
    for i, s in enumerate(steps, 1):
        if isinstance(s, dict):
            text = s.get("text", "")
            mins = s.get("timerMinutes")
            if mins:
                text = f"{text}  [timer: {mins} min]"
        else:
            text = str(s)
        out.append(f"{i}. {text}")
    return "\n".join(out)


def extract_json(text):
    m = re.search(r"\{.*\}", text, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    # The model can hit max_tokens mid-JSON (unclosed brace). Fall back to
    # pulling the description field out of the truncated text directly.
    dm = re.search(r'"description"\s*:\s*"((?:[^"\\]|\\.)*)"', text, re.S)
    if dm:
        return {"description": json.loads('"' + dm.group(1) + '"'), "issues": []}
    return {}


def call(recipe, timeout=120, retries=3):
    """Ask Kimi to rewrite the description + flag issues for one recipe."""
    if not KEY:
        return {"slug": recipe["id"], "title": recipe.get("title"), "status": 401,
                "description": None, "issues": [], "raw": "KIMI_API_KEY not set", "ms": 0}
    ingredients = format_list(recipe.get("ingredients"))
    steps = format_steps(recipe.get("steps"))
    payload = {
        "model": KIMI_MODEL, "max_tokens": 400, "temperature": 0, "stream": False,
        "messages": [{"role": "user", "content": PROMPT.format(
            title=recipe.get("title", ""), category=recipe.get("category", ""),
            prep=recipe.get("prepTime", 0), cook=recipe.get("cookTime", 0),
            servings=recipe.get("servings", 0), ingredients=ingredients, steps=steps,
        )}],
    }
    body = json.dumps(payload).encode()
    last = {"slug": recipe["id"], "title": recipe.get("title"), "status": 0,
            "description": None, "issues": [], "raw": "", "ms": 0}
    for attempt in range(retries):
        req = urllib.request.Request(KIMI_URL, data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("Authorization", f"Bearer {KEY}")
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                d = json.loads(r.read().decode())
            text = d["choices"][0]["message"].get("content") or ""
            v = extract_json(text)
            last.update({
                "status": 200, "description": (v.get("description") or "").strip() or None,
                "issues": v.get("issues") or [],
                "raw": text[:400], "ms": int((time.time() - t0) * 1000),
            })
            return last
        except urllib.error.HTTPError as e:
            if e.code == 401:
                last.update({"status": 401, "raw": "AUTH FAILED"})
                return last
            if e.code == 429:
                last.update({"status": 429, "raw": "429 rate-limit",
                             "ms": int((time.time() - t0) * 1000)})
                time.sleep(5 * (attempt + 1)); continue
            if e.code >= 500:
                last.update({"status": e.code, "raw": f"{e.code} server error",
                             "ms": int((time.time() - t0) * 1000)})
                time.sleep(3 * (attempt + 1)); continue
            last.update({"status": e.code, "raw": e.read().decode()[:200],
                         "ms": int((time.time() - t0) * 1000)})
            break
        except Exception as e:
            last.update({"status": 0, "raw": str(e), "ms": int((time.time() - t0) * 1000)})
            time.sleep(3 * (attempt + 1))
    return last


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--slugs", type=str, default="", help="only these slugs (comma-separated)")
    ap.add_argument("--retry", action="store_true",
                    help="re-run previous failures / missing descriptions, purging their lines")
    args = ap.parse_args()

    recipes = load_recipes()
    by_id = {r["id"]: r for r in recipes}

    if args.slugs:
        slugset = {s.strip() for s in args.slugs.split(",") if s.strip()}
        todo = [by_id[s] for s in slugset if s in by_id]
        print(f"slugs mode: {len(todo)} recipes to process")
    elif args.retry:
        done = load_done()
        bad = [slug for slug, r in done.items()
               if r.get("status") != 200 or not r.get("description")]
        purge_slugs(bad)
        todo = [by_id[s] for s in bad if s in by_id]
        print(f"retry mode: {len(todo)} previous failures to re-run, purged old lines")
    else:
        done = load_done()
        todo = [r for r in recipes if r["id"] not in done]
    if args.limit:
        todo = todo[: args.limit]
    print(f"total={len(recipes)} todo={len(todo)} workers={args.workers} model={KIMI_MODEL}")
    if not todo:
        print("nothing to do"); return

    import threading
    lock = threading.Lock()

    def work(recipe):
        r = call(recipe)
        with lock:
            with open(OUT_JSONL, "a", encoding="utf-8") as f:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        ok = "ok" if (r["status"] == 200 and r["description"]) else "!!"
        n_issues = len(r.get("issues") or [])
        print(f"[{ok}] {r['slug']} {r['status']} {r.get('ms')}ms "
              f"issues={n_issues} desc={str(r.get('description'))[:50]}", flush=True)
        return r

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        results = list(ex.map(work, todo))

    # Regenerate the aggregate JSON + report from the full checkpoint.
    done = load_done()
    suggestions = {}
    for slug, r in done.items():
        if r.get("status") == 200 and r.get("description"):
            suggestions[slug] = {
                "title": r.get("title") or by_id.get(slug, {}).get("title"),
                "description": r["description"],
                "issues": r.get("issues") or [],
            }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(suggestions, f, ensure_ascii=False, indent=2)

    lines = []
    lines.append("# AI Recipe Cleanup Report\n")
    lines.append(f"- Generated: {time.strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"- Total recipes: {len(recipes)}")
    lines.append(f"- Suggestions written: {len(suggestions)}\n")
    errors = [r for r in done.values() if r.get("status") != 200]
    if errors:
        lines.append(f"## Errors ({len(errors)})\n")
        for r in errors:
            lines.append(f"- {r['slug']} {r.get('status')} {r.get('raw', '')[:120]}")
        lines.append("")
    for slug, r in done.items():
        if r.get("status") == 200 and r.get("description"):
            issues = r.get("issues") or []
            if issues:
                lines.append(f"## {r.get('title')} (`{slug}`) — {len(issues)} issue(s)")
                for i in issues:
                    lines.append(f"- {i}")
                lines.append("")
    with open(OUT_REPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    bad = sum(1 for r in done.values() if not r.get("description") and r.get("status") == 200)
    print(f"\nDONE: {len(suggestions)} suggestions written to {OUT_JSON}; "
          f"{bad} recipes got no description; report at {OUT_REPORT}")


if __name__ == "__main__":
    main()
