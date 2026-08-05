#!/usr/bin/env python3
"""make-contact-sheets.py - Build labeled contact sheets of every recipe image
so a human/LLM can eyeball all 1324 photos at once and flag "wrong but unique"
images (non-food, logo, person, package, screenshot, or food that doesn't match
the title).

Output: <out_dir>/sheet-<NN>.png (8 cols x 5 rows = 40 cells each) plus a
manifest.json mapping each sheet + cell index -> recipe slug.

Usage: python scripts/audit/make-contact-sheets.py [--out DIR] [--cols 8] [--rows 5]
"""
import json
import os
import argparse
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RECIPES_JSON = os.path.join(BASE, 'recipes.json')
IMAGES_DIR = os.path.join(BASE, 'images')

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
    """Center-crop + resize an image to exactly w x h, preserving aspect."""
    img = img.convert('RGB')
    ratio = max(w / img.width, h / img.height)
    nw, nh = max(w, int(img.width * ratio)), max(h, int(img.height * ratio))
    img = img.resize((nw, nh), Image.LANCZOS)
    x = (nw - w) // 2
    y = (nh - h) // 2
    return img.crop((x, y, x + w, y + h))


def truncate(s, n):
    return s if len(s) <= n else s[: n - 1] + '…'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(BASE, 'contact_sheets'))
    ap.add_argument('--cols', type=int, default=8)
    ap.add_argument('--rows', type=int, default=5)
    args = ap.parse_args()

    recipes = json.load(open(RECIPES_JSON, encoding='utf-8'))['recipes']
    os.makedirs(args.out, exist_ok=True)

    CELL_W, CELL_H = 320, 264
    IMG_W, IMG_H = CELL_W, 200
    PAD = 6

    font_t = load_font(15)
    font_s = load_font(11)

    manifest = []
    per_sheet = args.cols * args.rows
    n_sheets = (len(recipes) + per_sheet - 1) // per_sheet

    for s in range(n_sheets):
        chunk = recipes[s * per_sheet: (s + 1) * per_sheet]
        sheet = Image.new('RGB', (args.cols * CELL_W, args.rows * CELL_H), 'white')
        draw = ImageDraw.Draw(sheet)
        for i, r in enumerate(chunk):
            col, row = i % args.cols, i // args.cols
            x, y = col * CELL_W + PAD, row * CELL_H + PAD
            path = os.path.join(IMAGES_DIR, r['id'] + '.jpg')
            try:
                img = cover_crop(Image.open(path), IMG_W - PAD * 2, IMG_H - PAD * 2)
                sheet.paste(img, (x, y))
            except Exception as e:
                draw.rectangle([x, y, x + IMG_W - PAD * 2, y + IMG_H - PAD * 2],
                               fill='#cccccc')
                draw.text((x + 4, y + 4), 'NO IMAGE: ' + str(e)[:20],
                          fill='red', font=font_s)
            ty = y + IMG_H - PAD * 2 + 2
            draw.text((x + 2, ty), truncate(r['title'], 40), fill='black', font=font_t)
            draw.text((x + 2, ty + 17), truncate(r['category'] + ' | ' + r['id'], 42),
                      fill='#555555', font=font_s)
            manifest.append({'sheet': s, 'cell': i, 'slug': r['id'],
                             'title': r['title'], 'category': r['category']})

        out = os.path.join(args.out, f'sheet-{s:02d}.png')
        sheet.save(out, 'PNG')

    with open(os.path.join(args.out, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump({'cols': args.cols, 'rows': args.rows, 'cells': manifest},
                  f, ensure_ascii=False, indent=1)
    print(f'Wrote {n_sheets} sheets ({len(recipes)} recipes, {per_sheet}/sheet) to {args.out}')


if __name__ == '__main__':
    main()
