#!/usr/bin/env python3
"""
fetch-images.py - Download a relevant image per recipe from DuckDuckGo image
search, downscale to ~800px JPEG, and save into /images as <slug>.jpg.
Updates recipes.json `image` paths at the end (--write).

Usage:
    python fetch-images.py [--count N] [--write] [--threads N]

State is persisted in image-fetch-results.json so runs are resumable.
Searches are rate-limited globally (adaptive backoff) because concurrent
DuckDuckGo queries get throttled; downloads run in parallel.

FAILURE POLICY: a recipe either gets a unique, real image, or it is marked
FAILED and loudly reported (image-fetch-failures.json + non-zero exit). The
script NEVER substitutes a shared/generic/theme image, and never writes a
fallback path into recipes.json. Only "OK" state is written back.
"""
import base64
import json
import io
import os
import re
import time
import argparse
import threading
import urllib.parse
from urllib.request import Request, urlopen

from ddgs import DDGS
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
RECIPES_JSON = os.path.join(BASE, 'recipes.json')
IMAGES_DIR = os.path.join(BASE, 'images')
STATE_FILE = os.path.join(BASE, 'image-fetch-results.json')

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36')

# Image paths matching these substrings are placeholders/fallbacks that must be
# replaced with a real, per-recipe image. A genuine recipe photo is also unique
# to one recipe, so any path shared by 2+ recipes is treated as wrong too.
BAD_IMAGE_MARKERS = ('placeholder', 'fallback', 'generic', 'default')

# Kimi Moonshot vision gate (used only when --validate is passed).
KIMI_KEY = os.environ.get('KIMI_API_KEY', '')
KIMI_VISION_URL = 'https://api.moonshot.ai/v1/chat/completions'
KIMI_VISION_MODEL = 'moonshot-v1-32k-vision-preview'
VISION_PROMPT = (
    'This image is the hero photo for a recipe titled "{title}". '
    'Describe what the image actually shows and decide if it is an acceptable recipe photo. '
    'Reply with ONLY a JSON object, no markdown, no prose:\n'
    '{{"item": "one short phrase naming what is shown", '
    '"ok": true_or_false, "issue": "if not ok, the specific problem; else \\"\\" "}}\n'
    'Set ok=false ONLY if the image is blank/broken/placeholder, is a text/logo screenshot, '
    'or clearly does not match the recipe (e.g. a savory dish where a cake is expected). '
    'An image that shows the dish is ok=true.')


def vision_check_image(path, title, timeout=60):
    """Return (accepted: bool, reason: str) from the Kimi vision model."""
    if not KIMI_KEY:
        return False, 'KIMI_API_KEY not set'
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    payload = {
        'model': KIMI_VISION_MODEL, 'max_tokens': 160, 'temperature': 0, 'stream': False,
        'messages': [{'role': 'user', 'content': [
            {'type': 'text', 'text': VISION_PROMPT.format(title=title)},
            {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{b64}'}},
        ]}],
    }
    req = Request(KIMI_VISION_URL, data=json.dumps(payload).encode(), method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Authorization', f'Bearer {KIMI_KEY}')
    try:
        with urlopen(req, timeout=timeout) as r:
            d = json.loads(r.read().decode())
        text = d['choices'][0]['message'].get('content') or ''
        m = re.search(r'\{.*\}', text, re.S)
        verdict = json.loads(m.group(0)) if m else {}
        if verdict.get('ok') is True:
            return True, 'match'
        return False, str(verdict.get('issue') or verdict.get('item') or 'no match')
    except Exception as e:
        return False, f'vision err: {e}'


def is_bad_image(img, image_usage=None):
    """True when a recipe image is missing, a placeholder/fallback, or shared.

    image_usage: optional Counter of image path -> recipe count. When provided,
    any path used by more than one recipe is flagged.
    """
    if not img:
        return True
    low = img.lower()
    if any(m in low for m in BAD_IMAGE_MARKERS):
        return True
    if image_usage and image_usage[img] > 1:
        return True
    return False


class Fetcher:
    def __init__(self, count, write, threads, slugs='', force=False,
                 candidates=3, validate=False, queries_file=''):
        self.count = count
        self.write = write
        self.threads = threads
        self.slugs = {s.strip() for s in slugs.split(',') if s.strip()}
        self.force = force
        self.candidates = candidates
        self.validate = validate
        self.query_overrides = {}
        if queries_file and os.path.exists(queries_file):
            self.query_overrides = json.load(open(queries_file, encoding='utf-8'))
        self.lock = threading.Lock()
        self.search_lock = threading.Lock()
        self.last_search = 0.0
        self.gap = 1.6  # seconds between DDG searches; adapts to throttling
        self.state = {}
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                self.state = json.load(f)
        self.failures = []  # recipes that failed to fetch (loudly reported)
        self.done = 0
        self.failed = 0
        self.consecutive_ok = 0

    # ---- Rate-limited search ----
    def search_images(self, query, retries=5):
        """Spaced DDG image search with adaptive backoff. Returns result dicts."""
        for attempt in range(retries):
            # Enforce global min spacing between searches.
            with self.search_lock:
                wait = self.last_search + self.gap - time.time()
                if wait > 0:
                    time.sleep(wait)
                self.last_search = time.time()
            try:
                results = list(DDGS().images(query, max_results=5))
                if not results:
                    raise RuntimeError('empty')
                # Success: nudge gap down a touch.
                self.consecutive_ok += 1
                if self.consecutive_ok > 8:
                    self.gap = max(1.1, self.gap * 0.92)
                return results
            except Exception:
                # Throttled: back off.
                self.consecutive_ok = 0
                self.gap = min(6.0, self.gap * 1.3)
                time.sleep(self.gap)
        return []

    def download_image(self, url, dest):
        try:
            req = Request(url, headers={
                'User-Agent': UA,
                'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
            })
            with urlopen(req, timeout=12) as resp:
                ctype = resp.headers.get('Content-Type', '') or ''
                if 'image' not in ctype:
                    if not url.lower().rsplit('.', 1)[-1] in ('jpg', 'jpeg', 'png', 'webp', 'gif'):
                        return False
                data = resp.read(2_000_000)
            if len(data) < 8000:
                return False
            img = Image.open(io.BytesIO(data))
            img.load()
            img = img.convert('RGB')
            img.thumbnail((800, 800))
            img.save(dest, 'JPEG', quality=82, optimize=True)
            return os.path.getsize(dest) > 5000
        except Exception:
            return False

    def fetch_one(self, recipe):
        slug = recipe['id']
        dest = os.path.join(IMAGES_DIR, f'{slug}.jpg')
        local = f'/images/{slug}.jpg'

        # Legacy resume: an existing image is accepted unless --force.
        if not self.force:
            if self.state.get(slug) == 'OK' and os.path.exists(dest):
                return slug, local
            if os.path.exists(dest):
                with self.lock:
                    self.state[slug] = 'OK'
                return slug, local

        attempts = self.query_overrides.get(slug)
        if not attempts:
            # Default: raw title, a cleaned variant (strip special characters
            # like "Lyle's®" -> "Lyles  Caramel Chocolate Shortcake"), then
            # title+recipe for the dish-type hint.
            query = recipe.get('title', slug)
            attempts = [query]
            cleaned = ' '.join(
                ''.join(c if (c.isalnum() or c.isspace()) else ' ' for c in query).split()
            )
            if cleaned and cleaned != query:
                attempts.append(cleaned)
            recipe_q = f'{cleaned or query} recipe'
            if recipe_q not in attempts:
                attempts.append(recipe_q)

        title = recipe.get('title', slug)
        tried = 0
        for attempt in attempts:
            # Primary source: DuckDuckGo. Fallback: Openverse CC search (DDG
            # often returns junk for ambiguous/obscure titles).
            sources = (('ddg', (r.get('image') for r in self.search_images(attempt))),
                       ('openverse', self.search_openverse(attempt)))
            for _source, urls in sources:
                for url in urls:
                    if not url:
                        continue
                    tried += 1
                    if self.accept_candidate(url, dest, title):
                        with self.lock:
                            self.state[slug] = 'OK'
                        return slug, local
                    if tried >= self.candidates:
                        break
                if tried >= self.candidates:
                    break
            if tried >= self.candidates:
                break

        # Loud failure: never substitute a shared/generic fallback image. Mark
        # the recipe FAILED so recipes.json is left untouched and the failure
        # is reported below (image-fetch-failures.json + non-zero exit).
        reason = (f'no acceptable image after up to {self.candidates} candidate(s) '
                  f'x {len(attempts)} query variant(s)'
                  + (' (vision-rejected)' if self.validate
                     else ' (rate-limited or no relevant results)'))
        with self.lock:
            self.failed += 1
            self.state[slug] = 'FAILED'
            self.failures.append({
                'id': slug,
                'title': recipe.get('title'),
                'previous_image': recipe.get('image'),
                'reason': reason,
            })
        print(f'  !! FAILED  "{recipe.get("title")}" ({slug}): {reason}',
              flush=True)
        return slug, None

    def search_openverse(self, query, n=5):
        """Fallback image source: Openverse CC search. Returns direct image URLs."""
        try:
            url = ('https://api.openverse.org/v1/images/?q=' +
                   urllib.parse.quote(query) + f'&page_size={n}')
            req = Request(url, headers={'User-Agent': UA})
            with urlopen(req, timeout=20) as r:
                d = json.loads(r.read().decode())
            return [res.get('url') for res in d.get('results', []) if res.get('url')]
        except Exception:
            return []

    def accept_candidate(self, url, dest, title):
        """Download to a temp file and, if --validate, require a Kimi vision
        match on the recipe title before replacing the final image.
        Returns True on accept."""
        tmp = dest + '.tmp'
        try:
            if not self.download_image(url, tmp):
                return False
            if self.validate:
                ok, reason = vision_check_image(tmp, title)
                if not ok:
                    print(f'    - reject {os.path.basename(dest)}: {url[:70]} ({reason})',
                          flush=True)
                    os.remove(tmp)
                    return False
            os.replace(tmp, dest)
            return True
        except Exception:
            try:
                os.remove(tmp)
            except OSError:
                pass
            return False

    def run(self):
        with open(RECIPES_JSON, 'r', encoding='utf-8') as f:
            recipes = json.load(f)['recipes']

        # Any image path shared by 2+ recipes is a wrong/fallback image.
        from collections import Counter
        image_usage = Counter(r.get('image') for r in recipes)

        if self.slugs:
            targets = [r for r in recipes if r['id'] in self.slugs]
        else:
            targets = [r for r in recipes if is_bad_image(r.get('image'), image_usage)]
        todo = [r for r in targets if self.force or self.state.get(r['id']) != 'OK']
        if self.count:
            todo = todo[:self.count]
        print(f'Targets: {len(targets)}  To process: {len(todo)}'
              + ('  [force]' if self.force else '')
              + ('  [validate]' if self.validate else ''), flush=True)

        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.threads) as ex:
            futs = {ex.submit(self.fetch_one, r): r for r in todo}
            for fut in concurrent.futures.as_completed(futs):
                fut.result()
                with self.lock:
                    self.done += 1
                if self.done % 25 == 0 or self.done == len(todo):
                    print(f'  progress {self.done}/{len(todo)} (failed={self.failed}, gap={self.gap:.1f}s)', flush=True)
                    self.save_state()

        self.save_state()
        print(f'Done. processed={self.done} failed={self.failed}', flush=True)

        # Only OK state yields a path to write — a FAILED recipe keeps whatever
        # it already had, so recipes.json is never given a fallback/shared path.
        image_paths = {}
        for r in recipes:
            slug = r['id']
            if self.state.get(slug) == 'OK':
                image_paths[slug] = f'/images/{slug}.jpg'

        if self.write:
            for r in recipes:
                if r['id'] in image_paths:
                    r['image'] = image_paths[r['id']]
            with open(RECIPES_JSON, 'w', encoding='utf-8') as f:
                json.dump({'recipes': recipes}, f, ensure_ascii=False, indent=2)
            n_img = sum(1 for r in recipes
                        if r.get('image') and not is_bad_image(r.get('image'), image_usage))
            print(f'Wrote recipes.json. recipes with real images: {n_img}/{len(recipes)}',
                  flush=True)

        if self.failures:
            with open('image-fetch-failures.json', 'w', encoding='utf-8') as f:
                json.dump(self.failures, f, ensure_ascii=False, indent=2)
            print(f'\n!! {len(self.failures)} recipe(s) FAILED to get an image. '
                  f'See image-fetch-failures.json. Their recipes.json entries were '
                  f'NOT modified.', flush=True)
        else:
            print('\nAll targets succeeded — no failures.', flush=True)

        unresolved = [r['id'] for r in recipes
                      if is_bad_image(r.get('image'), image_usage)]
        print(f'Still bad/missing image after run: {len(unresolved)}', flush=True)
        if unresolved:
            print('  ' + ', '.join(unresolved), flush=True)

        # ddgs/urllib may leave non-daemon threads alive on Windows.
        os._exit(1 if self.failures else 0)

    def save_state(self):
        with self.lock:
            with open(STATE_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.state, f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--count', type=int, default=0)
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--threads', type=int, default=8)
    ap.add_argument('--slugs', type=str, default='',
                    help='only these recipe ids (comma-separated)')
    ap.add_argument('--force', action='store_true',
                    help='re-fetch even if an image already exists on disk')
    ap.add_argument('--candidates', type=int, default=3,
                    help='max image candidates tried per recipe (stop at first accept)')
    ap.add_argument('--validate', action='store_true',
                    help='require a Kimi vision match on the recipe title before accepting')
    ap.add_argument('--queries', type=str, default='',
                    help='JSON file mapping slug -> [search queries] to try (overrides title queries)')
    args = ap.parse_args()

    os.makedirs(IMAGES_DIR, exist_ok=True)
    Fetcher(args.count, args.write, args.threads,
            slugs=args.slugs, force=args.force,
            candidates=args.candidates, validate=args.validate,
            queries_file=args.queries).run()


if __name__ == '__main__':
    main()
