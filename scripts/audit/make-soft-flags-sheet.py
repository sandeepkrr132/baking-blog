#!/usr/bin/env python3
"""make-soft-flags-sheet.py - Build a labeled review contact sheet of the
soft-flag images (ok=false verdicts from vision-check-results.jsonl) so a
human can eyeball each one and decide keep / re-scrape / drop.

All labels come from the saved Kimi Moonshot verdicts in
vision-check-results.jsonl — this script performs NO image-processing API
calls. If a re-verification is ever wanted, route it through Kimi
(vision-check.py), not a local model.

Output: contact_sheets/soft-flags-review.png (+ manifest json)

Usage: python scripts/audit/make-soft-flags-sheet.py [--cols 4] [--out DIR]
"""
import json, os, argparse
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMAGES_DIR = os.path.join(BASE, 'images')
RESULTS = os.path.join(BASE, 'vision-check-results.jsonl')

FONT_PATHS = [
    r'C:\Windows\Fonts\segoeui.ttf',
    r'C:\Windows\Fonts\arial.ttf',
    r'C:\Windows\Fonts\calibri.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]


def load_font(size):
    for p in FONT_PATHS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def cover_crop(img, w, h):
    img = img.convert('RGB')
    ratio = max(w / img.width, h / img.height)
    nw, nh = max(w, int(img.width * ratio)), max(h, int(img.height * ratio))
    img = img.resize((nw, nh), Image.LANCZOS)
    x, y = (nw - w) // 2, (nh - h) // 2
    return img.crop((x, y, x + w, y + h))


def truncate(s, n):
    return s if len(s) <= n else s[: n - 1] + '…'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cols', type=int, default=4)
    ap.add_argument('--out', default=os.path.join(BASE, 'contact_sheets',
                                                  'soft-flags-review.png'))
    args = ap.parse_args()

    rows = [json.loads(l) for l in open(RESULTS, encoding='utf-8')]
    flags = [r for r in rows if r.get('ok') is False]
    flags.sort(key=lambda r: r.get('slug', ''))
    print(f'{len(flags)} soft flags from {RESULTS}')

    cols = args.cols
    CELL_W, CELL_H, IMG_H, PAD = 520, 300, 190, 8
    rows_n = (len(flags) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * CELL_W, rows_n * CELL_H), '#f4f4f4')
    draw = ImageDraw.Draw(sheet)
    font_t = load_font(15)
    font_s = load_font(12)
    font_b = load_font(12)

    manifest = []
    for i, r in enumerate(flags):
        col, row = i % cols, i // cols
        x, y = col * CELL_W + PAD, row * CELL_H + PAD
        slug = r.get('slug', '?')
        path = os.path.join(IMAGES_DIR, slug + '.jpg')
        try:
            img = cover_crop(Image.open(path), CELL_W - PAD * 2, IMG_H - PAD * 2)
            sheet.paste(img, (x, y))
        except Exception as e:
            draw.rectangle([x, y, x + CELL_W - PAD * 2, y + IMG_H - PAD * 2],
                           fill='#cccccc')
            draw.text((x + 6, y + 6), 'NO IMAGE: ' + str(e)[:24],
                      fill='red', font=font_s)

        ty = y + IMG_H - PAD * 2 + 6
        draw.text((x + 2, ty), truncate(r.get('title') or slug.replace('-', ' ').title(), 48),
                  fill='black', font=font_t)
        draw.text((x + 2, ty + 20), truncate('Kimi: ' + str(r.get('item') or ''), 56),
                  fill='#8a2b2b', font=font_b)
        draw.text((x + 2, ty + 38), truncate(str(r.get('issue') or ''), 72),
                  fill='#444444', font=font_s)
        draw.text((x + 2, ty + 56), truncate('verdict: ' + str(r.get('model') or 'kimi'), 48),
                  fill='#888888', font=font_s)
        manifest.append({'slug': slug, 'title': r.get('title'),
                         'item': r.get('item'), 'issue': r.get('issue'),
                         'model': r.get('model'), 'cell': i})

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    sheet.save(args.out, 'PNG')
    mf = os.path.splitext(args.out)[0] + '-manifest.json'
    with open(mf, 'w', encoding='utf-8') as f:
        json.dump({'cols': cols, 'cells': manifest}, f, ensure_ascii=False, indent=1)
    print(f'Wrote {args.out}  ({len(flags)} cells, {cols} cols, {rows_n} rows)')
    print(f'Manifest: {mf}')


if __name__ == '__main__':
    main()
