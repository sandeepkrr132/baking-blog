"""Vision check all baking-blog recipe images against their recipe titles.

Sends each image to Kimi Moonshot (`moonshot-v1-32k-vision-preview`) asking whether
it plausibly shows the named dish, flags blank/broken/wrong-content images.

- Resumable: appends one JSON line per image to vision-check-results.jsonl;
  already-processed slugs are skipped on restart.
- Concurrent workers with retry/backoff; aborts on 401.
- Downscales to cap input tokens (cost).

Usage:
  python vision-check.py                # all images, 4 workers, max 640px
  python vision-check.py --limit 10     # test on first 10
  python vision-check.py --workers 6 --max-size 768
"""
import argparse, base64, concurrent.futures, io, json, os, re, sys, time, urllib.error, urllib.request
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))

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
PROXY_KEY = os.environ.get("PROXY_KEY")  # omniroute gateway (opencode free relay) — set in .env or the environment
KIMI_URL = "https://api.moonshot.ai/v1/chat/completions"
GATEWAY_URL = "http://localhost:20128/v1/chat/completions"
# (model, url, api_key) tried in order per image; CLOUD MODELS ONLY (no local Ollama)
MODEL_CHAIN = [
    ("moonshot-v1-32k-vision-preview", KIMI_URL, KEY),   # Kimi Moonshot — primary cloud vision path
    ("oc/ling-3.0-flash-free", GATEWAY_URL, PROXY_KEY),  # opencode free relay (cloud-only; local ollama bridge removed 2026-08-04)
    ("oc/nemotron-3-super-free", GATEWAY_URL, PROXY_KEY),
]
IMGDIR = os.path.join(BASE, "images")
OUT = os.path.join(BASE, "vision-check-results.jsonl")

PROMPT = (
    "This image is the hero photo for a recipe titled \"{title}\". "
    "Describe what the image actually shows and decide if it is an acceptable recipe photo. "
    "Reply with ONLY a JSON object, no markdown, no prose:\n"
    '{{"item": "one short phrase naming what is shown", '
    '"ok": true_or_false, "issue": "if not ok, the specific problem; else \"\" "}}\n'
    "Set ok=false ONLY if the image is blank/broken/placeholder, is a text/logo screenshot, "
    "or clearly does not match the recipe (e.g. savory dish where a cake is expected). "
    "Minor styling differences are ok. An image that shows the dish is ok=true."
)

def slug_title(slug, manifest):
    if slug in manifest:
        return manifest[slug].get("title") or slug.replace("-", " ").title()
    return slug.replace("-", " ").title()

def load_manifest():
    m = {}
    p = os.path.join(BASE, "contact_sheets", "manifest.json")
    if os.path.exists(p):
        for c in json.load(open(p, encoding="utf-8")).get("cells", []):
            m[c["slug"]] = {"title": c.get("title"), "category": c.get("category")}
    return m

def existing_done():
    done = set()
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            for line in f:
                try:
                    done.add(json.loads(line)["slug"])
                except Exception:
                    pass
    return done

def load_results():
    rows = []
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            for line in f:
                try:
                    rows.append(json.loads(line))
                except Exception:
                    pass
    return rows

def purge_slugs(slugs):
    """Remove JSONL lines for the given slugs, keep the rest (for a clean retry)."""
    kept = [r for r in load_results() if r.get("slug") not in slugs]
    with open(OUT, "w", encoding="utf-8") as f:
        for r in kept:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return len(kept)

def encode_image(path, max_size):
    im = Image.open(path).convert("RGB")
    if max(im.size) > max_size:
        im.thumbnail((max_size, max_size), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=88)
    return "image/jpeg", base64.b64encode(buf.getvalue()).decode()

def call(slug, title, path, max_size, timeout=150, retries=3):
    """Try each cloud model in MODEL_CHAIN until one returns a verdict."""
    media, b64 = encode_image(path, max_size)
    last = {"slug": slug, "title": title, "status": 0, "ok": None,
            "issue": "no model in chain responded", "ms": 0}
    for model, url, key in MODEL_CHAIN:
        payload = {
            "model": model, "max_tokens": 160, "temperature": 0, "stream": False,
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": PROMPT.format(title=title)},
                {"type": "image_url", "image_url": {"url": f"data:{media};base64,{b64}"}},
            ]}],
        }
        body = json.dumps(payload).encode()
        for attempt in range(retries):
            req = urllib.request.Request(url, data=body, method="POST")
            req.add_header("Content-Type", "application/json")
            req.add_header("Authorization", f"Bearer {key}")
            t0 = time.time()
            try:
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    d = json.loads(r.read().decode())
                text = d["choices"][0]["message"].get("content") or ""
                verdict = extract_json(text)
                return {"slug": slug, "title": title, "model": model, "status": 200,
                        "ok": verdict.get("ok"), "item": verdict.get("item"),
                        "issue": verdict.get("issue"), "raw": text[:300],
                        "ms": int((time.time() - t0) * 1000)}
            except urllib.error.HTTPError as e:
                if e.code == 401:
                    return {"slug": slug, "status": 401, "ok": None,
                            "issue": f"AUTH FAILED on {model}", "ms": 0}
                if e.code == 429:
                    last = {"slug": slug, "status": 429, "ok": None,
                            "issue": f"{model} 429 rate-limit", "ms": int((time.time()-t0)*1000)}
                    time.sleep(5 * (attempt + 1)); continue
                if e.code >= 500:
                    last = {"slug": slug, "status": e.code, "ok": None,
                            "issue": f"{model} {e.code}", "ms": int((time.time()-t0)*1000)}
                    time.sleep(3 * (attempt + 1)); continue
                last = {"slug": slug, "status": e.code, "ok": None,
                        "issue": f"{model} {e.read().decode()[:100]}",
                        "ms": int((time.time()-t0)*1000)}
                break
            except Exception as e:
                last = {"slug": slug, "status": 0, "ok": None,
                        "issue": f"{model}: {e}", "ms": int((time.time()-t0)*1000)}
                time.sleep(3 * (attempt + 1))
    return last

def extract_json(text):
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--max-size", type=int, default=640)
    ap.add_argument("--retry", action="store_true", help="re-run only previous failures (status!=200), purging their old lines")
    ap.add_argument("--retry-unknown", action="store_true", help="re-run only entries with no verdict (ok==None), purging their old lines")
    ap.add_argument("--slugs", type=str, default="", help="only these slugs (comma-separated)")
    args = ap.parse_args()

    manifest = load_manifest()
    files = sorted(f for f in os.listdir(IMGDIR) if f.lower().endswith(".jpg"))
    if args.slugs:
        slugset = {s.strip() for s in args.slugs.split(",") if s.strip()}
        todo = [f for f in files if f[:-4] in slugset]
        print(f"slugs mode: {len(todo)} images to check")
    elif args.retry:
        failures = [r for r in load_results() if r.get("status") != 200]
        slugs = [r["slug"] for r in failures]
        purge_slugs(slugs)
        todo = [f for f in files if f[:-4] in slugs]
        print(f"retry mode: {len(slugs)} previous failures to re-run, purged old lines")
    elif args.retry_unknown:
        unknowns = [r for r in load_results() if r.get("ok") is None]
        slugs = [r["slug"] for r in unknowns]
        purge_slugs(slugs)
        todo = [f for f in files if f[:-4] in slugs]
        print(f"retry-unknown mode: {len(slugs)} no-verdict images to re-run, purged old lines")
    else:
        done = existing_done()
        todo = [f for f in files if f[:-4] not in done]
    if args.limit:
        todo = todo[: args.limit]
    print(f"total={len(files)} todo={len(todo)} "
          f"workers={args.workers} max_size={args.max_size}")
    if not todo:
        print("nothing to do"); return

    lock = threading_lock()
    results = []
    def work(fname):
        slug = fname[:-4]
        r = call(slug, slug_title(slug, manifest), os.path.join(IMGDIR, fname), args.max_size)
        with lock:
            with open(OUT, "a", encoding="utf-8") as f:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        flag = "!!" if (r["ok"] is False or r["status"] != 200) else "ok"
        print(f"[{flag}] {slug} {r['status']} {r.get('ms')}ms ok={r.get('ok')} "
              f"item={str(r.get('item'))[:40]} issue={str(r.get('issue'))[:60]}", flush=True)
        return r

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        results = list(ex.map(work, todo))

    bad = [r for r in results if r.get("ok") is False]
    errs = [r for r in results if r.get("status") != 200]
    print(f"\nDONE: {len(results)} processed, {len(bad)} flagged, {len(errs)} errors (see {OUT})")

def threading_lock():
    import threading
    return threading.Lock()

if __name__ == "__main__":
    main()
