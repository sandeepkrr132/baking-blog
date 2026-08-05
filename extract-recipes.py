#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract-recipes.py
Parse the 5 baking ebooks in baking_receipes/ into a normalized recipe list
matching the Sweet Crumbs recipes.json schema, then write recipes_new.json.

Run: python extract-recipes.py
Output: recipes_new.json  ({ "recipes": [...] })
"""
import glob, os, re, json, sys
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET

SRC_DIR = r'C:\Users\rsand\OneDrive\Desktop\baking_receipes'
PLACEHOLDER_IMG = '/images/placeholder.svg'
OUT = 'recipes_new.json'

# ============================================================
# Small text helpers
# ============================================================

FRACTIONS = {'¼': '1/4', '½': '1/2', '¾': '3/4', '⅓': '1/3', '⅔': '2/3',
             '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
             '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6'}
FRAC_CLASS = r'[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]'
AMT_TOKEN = r'(?:\d+(?:\.\d+)?|\d+/\d+|[0-9]\s*-\s*[0-9]|' + FRAC_CLASS + r')'
NUMBER_WORDS = {'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'twelve': 12}
UNIT_WORDS = ('cup', 'cups', 'tsp', 'tsps', 'teaspoon', 'teaspoons', 'tbsp', 'tbsps',
              'tablespoon', 'tablespoons', 'tbs', 'tb', 'c', 't', 'oz', 'ounce', 'ounces',
              'lb', 'lbs', 'pound', 'pounds', 'g', 'grams', 'gram', 'kg', 'kilogram',
              'kilograms', 'stick', 'sticks', 'pinch', 'pinches', 'dash', 'clove', 'cloves',
              'slice', 'slices', 'can', 'cans', 'package', 'packages', 'packet', 'packets',
              'bunch', 'square', 'squares', 'sheet', 'sheets', 'leaf', 'leaves', 'drop',
              'drops', 'sprig', 'sprigs', 'piece', 'pieces', 'head', 'heads', 'segment',
              'segments', 'quart', 'quarts', 'pint', 'pints', 'gallon', 'gallons', 'ml',
              'milliliter', 'milliliters', 'liter', 'liters', 'litre', 'litres', 'qt', 'pt', 'gal')


def repair_text(s):
    """Best-effort cleanup of calibre/OCR artifacts (smart quotes, unicode
    fraction glyphs, etc.). The 'odd' chars in these ebooks are real Unicode
    fraction symbols (½ ¼ ¾ ⅓ …) and degree signs, not the U+FFFD replacement
    character."""
    if not s:
        return s
    s = s.replace('­', '')
    for a, b in [('‘', "'"), ('’', "'"), ('“', '"'), ('”', '"'),
                 ('–', '-'), ('—', '-'), ('…', '...')]:
        s = s.replace(a, b)
    # unicode fractions -> ASCII ("1½ cups" -> "1 1/2 cups", "½ cup" -> "1/2 cup")
    frac_cls = ''.join(re.escape(f) for f in FRACTIONS)
    s = re.sub(r'(\d)[' + frac_cls + r']', lambda m: m.group(1) + ' ' + FRACTIONS[m.group(0)[1]], s)
    s = re.sub(r'[' + frac_cls + r']', lambda m: FRACTIONS[m.group(0)], s)
    return s


def fix_word_amounts(s):
    """'three cups flour' -> '3 cups flour' (spelled-out amounts at line start)."""
    def repl(m):
        n = NUMBER_WORDS[m.group(1).lower()]
        return f'{n} {m.group(2)}'
    s = re.sub(r'\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+'
               r'(cup|cups|teaspoon|teaspoons|tsp|tablespoon|tablespoons|tbsp|tbs|'
               r'ounce|ounces|oz|pound|pounds|lb|lbs|g|grams|kg|stick|sticks|pinch|'
               r'clove|cloves|slice|slices|can|cans|package|package|packet|bunch|'
               r'piece|pieces)\b', repl, s, flags=re.I)
    return s


def sentence_case(s):
    """ALL CAPS run-on -> sentence case, keeping °F/°C units."""
    s = s.lower()
    s = re.sub(r'°([a-z])', lambda m: '°' + m.group(1).upper(), s)
    # capitalize first letter after . ! ? and at start
    s = re.sub(r'(^|[.!?]\s+)([a-z])', lambda m: m.group(1) + m.group(2).upper(), s)
    # fix '&' -> 'and'
    s = re.sub(r'\s*&\s*', ' and ', s)
    # collapse spaces
    s = re.sub(r'\s{2,}', ' ', s)
    return s.strip()


def is_allcaps(t):
    letters = [c for c in t if c.isalpha()]
    if not letters or len(t) < 8:
        return False
    upper = sum(1 for c in letters if c.isupper())
    return upper / len(letters) > 0.6


INSTRUCTION_WORDS = {'HEAT', 'PREHEAT', 'COMBINE', 'MIX', 'STIR', 'BEAT', 'WHISK',
                     'CREAM', 'FOLD', 'ADD', 'POUR', 'SPREAD', 'BAKE', 'COOL',
                     'SERVE', 'MELT', 'PLACE', 'IN', 'INTO', 'QUICKLY', 'GRADUALLY',
                     'TAKE', 'SPRINKLE', 'SIFT', 'GREASE', 'LINE', 'KNEAD', 'ROLL',
                     'SHAPE', 'DROP', 'SCOOP', 'TRANSFER', 'REMOVE', 'LET', 'PUT',
                     'TOP', 'BRUSH', 'CHILL', 'REFRIGERATE', 'FREEZE', 'BROWN',
                     'CARAMELIZE', 'WHIP', 'BLEND', 'STUFF', 'ASSEMBLE', 'DECORATE',
                     'MAKE', 'WORK', 'REST', 'DOUGH', 'PRESS', 'CRUMBLE', 'COVER',
                     'WRAP', 'THAW', 'DRAIN', 'RINSE', 'CHOP', 'MINCE', 'GLAZE'}


def is_method_start(t):
    """A long, mostly-uppercase paragraph, or one opening with an instruction verb."""
    if len(t) < 25:
        return False
    letters = [c for c in t if c.isalpha()]
    if letters:
        upper = sum(1 for c in letters if c.isupper())
        if upper / len(letters) > 0.35:
            return True
    first = t.strip().split()[0].upper().strip('.,;:')
    return first in INSTRUCTION_WORDS


def parse_time(s):
    """'1 hour 15 minutes' -> 75 (minutes) or None."""
    s = s.lower()
    h = re.search(r'(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h)\b', s)
    m = re.search(r'(\d+(?:\.\d+)?)\s*(?:mins?|minutes?|min)\b', s)
    total = 0
    if h:
        total += int(float(h.group(1)) * 60)
    if m:
        total += int(float(m.group(1)))
    return total if total > 0 else None


def parse_servings(s):
    nums = re.findall(r'\d+', s)
    if nums:
        vals = [int(n) for n in nums]
        return max(vals)
    m = re.search(r'\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\b', s, re.I)
    if m:
        return NUMBER_WORDS[m.group(1).lower()]
    return None


def strip_step_number(t):
    t = re.sub(r'^\s*\d+\s*[.)]', '', t).strip()
    return t


def split_ingredient_lines(text):
    """Split a paragraph that may contain several ingredients merged together."""
    parts = []
    pos = 0
    # lookahead: an amount token (digit/fraction/number-word) followed by a unit word or a countable noun
    pattern = re.compile(
        r'(?=\b(' + AMT_TOKEN + r'|[a-z]+\s*[a-z]*)\s+(' + '|'.join(
            re.escape(u) for u in sorted(UNIT_WORDS, key=len, reverse=True)
        ) + r')\b)', re.IGNORECASE)
    # simpler: split at each occurrence of <number/fraction> <unit>
    # the (?<![\d/.]) guard prevents splitting inside numbers, fractions and decimals
    pattern = re.compile(
        r'(?=(?<![\d/.])' + r'(?:' + AMT_TOKEN + r')\s*' + r'(?:cups?|tsp\.?s?|teaspoons?|tbsp\.?s?|tablespoons?|'
        r'tbs\.?|ounces?|oz\.?|pounds?|lb|lbs|grams?|g\b|kg|sticks?|cloves?|slices?|cans?|'
        r'packages?|packets?|squares?|sheets?|pieces?|leaves?|drops?|sprigs?|heads?|segments?|'
        r'quarts?|pints?|gallons?|ml\b|milliliters?|liters?|litres?|teaspoon|tablespoon)\b)',
        re.IGNORECASE)
    for m in pattern.finditer(text):
        if m.start() > 0:
            parts.append(text[pos:m.start()].strip())
            pos = m.start()
    parts.append(text[pos:].strip())
    return [p for p in parts if p]


def looks_like_ingredient(t):
    if re.match(AMT_TOKEN, t):
        return True
    if re.search(r'\b(cup|cups|tsp|tbsp|teaspoon|tablespoon|oz|ounce|pound|grams|g|kg|ml|stick|pinch|clove|slice|can|package|packet)\b', t, re.I):
        return True
    return False


# ============================================================
# Category / defaults
# ============================================================

def infer_category(title):
    t = title.lower()
    if re.search(r'\b(cookie|cookies|shortbread|biscotti|macaron|macarons|biscuits?)\b', t):
        return 'cookies'
    if re.search(r'\b(brownie|brownies|blondie|blondies|bar|bars|fudge)\b', t):
        return 'cookies'
    if re.search(r'\b(muffin|muffins)\b', t):
        return 'muffins'
    if re.search(r'\b(cake|cakes|cupcake|cupcakes|loaf|loaves|bundt|cheesecake|torte|genoise|dacquoise|bakewell)\b', t):
        return 'cakes'
    if re.search(r'\b(pie|pies|tart|tarts|quiche|galette|turnover|turnovers|empanada|strudel|hand pie)\b', t):
        return 'pies'
    if re.search(r'\b(bread|breads|roll|rolls|bun|buns|scone|scones|croissant|bagel|focaccia|ciabatta|doughnut|doughnuts|donut|donuts|fritter|beignet|brioche|babka|loaf|loaves)\b', t):
        return 'bread'
    if re.search(r'\b(trifle|pudding|mousse|icebox|dessert|parfait|souffl|meringue|custard|compote|cobbler|crisp|crumble|grunt|buckle|clafoutis|torte)\b', t):
        return 'desserts'
    return 'desserts'


TIME_DEFAULTS = {
    'cookies': (15, 10),
    'cakes': (20, 35),
    'bread': (20, 45),
    'pies': (25, 45),
    'muffins': (15, 20),
    'desserts': (15, 25),
}

CATEGORY_ALIASES = {
    'cupcakes': 'cakes',
    'breads': 'bread',
    'quick breads': 'bread',
    'brownies': 'cookies',
    'bars': 'cookies',
    'tarts': 'pies',
    'candy': 'desserts',
    'candies': 'desserts',
    'ice cream': 'desserts',
    'puddings': 'desserts',
    'candies': 'desserts',
}

CATEGORY_BUTTONS = ['cookies', 'cakes', 'bread', 'pies', 'muffins', 'desserts']


def difficulty_from(total):
    if total <= 30:
        return 'Easy'
    if total <= 75:
        return 'Medium'
    return 'Hard'


def gen_description(category, title):
    return f'A classic {category} recipe: {title}.'


# ============================================================
# EPUB helpers
# ============================================================

def get_outline(book):
    """Return (entries, by_name). entries = [(docname, aid, title)] in outline order."""
    docs = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))
    by_name = {d.get_name(): d for d in docs}
    outline_soup = None
    for item in docs:
        s = BeautifulSoup(item.get_content(), 'html.parser')
        if 'Outline' in s.get_text(' ', strip=True):
            outline_soup = s
            break
    if outline_soup is None:
        return [], by_name
    entries = []
    for li in outline_soup.find_all('li'):
        a = li.find('a')
        if not a:
            continue
        href = a.get('href', '')
        m = re.match(r'^(.*?)#(.*)$', href)
        if not m:
            continue
        docname, aid = m.group(1), m.group(2)
        if 'titlepage' in docname or 'nav' in docname:
            continue
        title = li.get_text(' ', strip=True)
        entries.append((docname, aid, title))
    return entries, by_name


def normalized(t):
    return re.sub(r'[^a-z0-9]+', ' ', t.lower()).strip()


def doc_paras(by_name, docname):
    """Return [(kind, text)] in order for a body doc.

    kind:
      'toc'    - paragraph with an `<a href="#...">` self-link (inline contents
                 entry; excluded from title matching)
      'anchor' - paragraph with an `<a id="...">` marker but no self-link
                 (real calibre body content)
      'plain'  - neither
    """
    item = by_name.get(docname)
    if item is None:
        return []
    soup = BeautifulSoup(item.get_content(), 'html.parser')
    paras = []
    for p in soup.body.find_all('p'):
        has_href = p.find('a', href=True) is not None
        has_id = False
        if not has_href:
            a = p.find('a')
            has_id = bool(a and a.get('id'))
        kind = 'toc' if has_href else ('anchor' if has_id else 'plain')
        txt = p.get_text(' ', strip=True)
        paras.append((kind, txt))
    return paras


def recipe_bodies(book, recipe_entries):
    """
    Yield (title, [para texts]) for each recipe by slicing the body documents at
    paragraphs whose normalized text equals one of the outline recipe titles.

    Calibre anchor ids are unreliable (offsets, missing markers on title
    paragraphs in later docs), so we match on normalized text of any non-TOC
    paragraph. The `toc` kind (paragraph with an `<a href="#...">` self-link)
    is skipped so inline contents sections never collide with recipe titles.
    """
    by_name = {d.get_name(): d for d in book.get_items_of_type(ebooklib.ITEM_DOCUMENT)}
    norm_to_title = {}
    for _, _, title in recipe_entries:
        nt = normalized(title)
        if nt and nt not in norm_to_title:
            norm_to_title[nt] = title
    title_set = set(norm_to_title)

    # ordered doc list: spine order (idrefs map to items), then any stragglers
    doc_names = []
    try:
        for ref in book.spine:
            if isinstance(ref, (tuple, list)):
                ref = ref[0]
            item = book.get_item_with_id(ref)
            if item is not None:
                nm = item.get_name()
                if nm in by_name and nm not in doc_names:
                    doc_names.append(nm)
    except Exception:
        pass
    for dn in by_name:
        if dn not in doc_names:
            doc_names.append(dn)

    results = []
    current = None
    for dn in doc_names:
        for kind, txt in doc_paras(by_name, dn):
            if kind == 'toc':
                continue
            nt = normalized(txt)
            if nt in title_set:
                if current is not None:
                    results.append(current)
                current = (norm_to_title[nt], [])
                continue
            if current is not None and txt:
                current[1].append(txt)
    if current is not None:
        results.append(current)
    return results


# ============================================================
# Per-book extractors  ->  yield (title, raw dict)
# ============================================================

def too_long_for_title(t):
    """Chapter-TOC blobs in the outline are giant concatenations of titles."""
    return len(t.split()) > 12


def too_short_for_title(t):
    return len(t.strip()) < 2


# --- Emma Katie: 1001 recipes, clean Time/Servings/Ingredients/Directions ---
KATIE_FRONT_EXACT = {'title page', 'copyright', 'table of contents', 'introduction',
                     'conclusion', 'thank you'}
KATIE_INGREDIENT_ITEMS = {'butter', 'milk', 'flour', 'baking powder', 'baking soda',
                          'yeast', 'sugar', 'cocoa powder', 'eggs', 'gelatin', 'nuts',
                          'salt', 'spices'}
KATIE_EQUIPMENT_ITEMS = {'baking pans', 'mixer', 'whisk', 'spatulas and wooden spoons',
                         'food processor', 'measuring spoons and cups', 'mixing bowls',
                         'baking paper or parchment paper'}


def extract_katie(book):
    entries, _ = get_outline(book)
    recipes = []
    for docname, aid, title in entries:
        tl = title.strip().lower()
        if tl in KATIE_FRONT_EXACT or tl in KATIE_INGREDIENT_ITEMS or tl in KATIE_EQUIPMENT_ITEMS:
            continue
        if tl.startswith(('ingredients ', 'equipment ')):
            continue
        if too_long_for_title(title) or too_short_for_title(title):
            continue
        recipes.append((docname, aid, title))
    for title, body in recipe_bodies(book, recipes):
        parsed = {'title': title, 'description': '', 'prep': None, 'cook': None,
                  'servings': None, 'ingredients': [], 'steps': []}
        section = None  # 'ingredients' | 'directions'
        last = None
        for para in body:
            low = para.lower().strip()
            if low.startswith('time:'):
                parsed['cook'] = parse_time(low)
                continue
            if low.startswith('servings'):
                parsed['servings'] = parse_servings(low)
                continue
            if low.startswith('ingredients') or low == 'ingredients:':
                section = 'ingredients'
                continue
            if low.startswith('directions') or low == 'directions:':
                section = 'directions'
                continue
            if low.startswith('nutritional information'):
                break
            if re.match(r'^calories:|^fat:|^protein:|^carbohydrates:', low):
                continue
            if section == 'ingredients':
                if looks_like_ingredient(para):
                    parsed['ingredients'].append(para)
            elif section == 'directions':
                step = strip_step_number(para)
                if step:
                    # continuation of previous step?
                    if re.match(r'^\d+[.)]', para) or last is None:
                        parsed['steps'].append(step)
                        last = step
                    else:
                        parsed['steps'][-1] += ' ' + step
                        last = parsed['steps'][-1]
        yield parsed


# --- Valeriu Cotet: 214 recipes, INGREDIENTS / INSTRUCTIONS ---
def extract_cotet(book):
    entries, _ = get_outline(book)
    recipes = []
    for docname, aid, title in entries:
        tl = title.strip().lower()
        if tl in ('ingredients', 'instructions', 'directions', 'preheat'):
            continue
        if too_long_for_title(title) or too_short_for_title(title):
            continue
        recipes.append((docname, aid, title))
    for title, body in recipe_bodies(book, recipes):
        parsed = {'title': title, 'description': '', 'prep': None, 'cook': None,
                  'servings': None, 'ingredients': [], 'steps': []}
        section = None
        last = None
        for para in body:
            low = para.strip().lower()
            if low == 'ingredients':
                section = 'ingredients'
                continue
            if low == 'instructions':
                section = 'directions'
                continue
            if low in ('garnish', 'rolling', 'filling', 'crust', 'topping', 'sauce', 'icing', 'frosting'):
                # keep sub-label as its own ingredient entry so following lines group loosely
                if section == 'ingredients':
                    parsed['ingredients'].append(para.strip())
                    continue
            if section == 'ingredients':
                for ing in split_ingredient_lines(para):
                    if looks_like_ingredient(ing) or ing.isupper() or len(ing) < 40:
                        parsed['ingredients'].append(ing)
            elif section == 'directions':
                step = strip_step_number(para)
                if step:
                    if re.match(r'^\d+[.)]', para) or last is None:
                        parsed['steps'].append(step)
                        last = step
                    else:
                        parsed['steps'][-1] += ' ' + step
                        last = parsed['steps'][-1]
        yield parsed


# --- Sharon Belcher: 350 recipes, 'What you need' / 'What to do' ---
BELCHER_CATEGORY_PREFIX = ('cookies', 'cakes', 'breads', 'brownies', 'pies', 'muffins',
                           'desserts', 'bars', 'tarts', 'cupcakes', 'candy', 'ice cream',
                           'puddings', 'candies', 'quick breads')


def extract_belcher(book):
    entries, _ = get_outline(book)
    recipes = []
    for docname, aid, title in entries:
        tl = title.strip().lower()
        if tl in ('one more thing...', 'what you need', 'what to do', 'how to make',
                  'ingredients', 'instructions', 'directions'):
            continue
        if too_long_for_title(title) or too_short_for_title(title):
            continue
        recipes.append((docname, aid, title))
    for title, body in recipe_bodies(book, recipes):
        parsed = {'title': title, 'description': '', 'prep': None, 'cook': None,
                  'servings': None, 'ingredients': [], 'steps': []}
        section = None
        last = None
        for para in body:
            low = para.strip().lower()
            if low.startswith('what you need'):
                section = 'ingredients'
                continue
            if low.startswith('what to do') or low.startswith('how to make') or low.startswith('how to'):
                section = 'directions'
                continue
            if section == 'ingredients':
                for ing in split_ingredient_lines(para):
                    if looks_like_ingredient(ing) or ing.isupper() or len(ing) < 40:
                        parsed['ingredients'].append(ing)
            elif section == 'directions':
                step = strip_step_number(para)
                if step:
                    if re.match(r'^\d+[.)]', para) or last is None:
                        parsed['steps'].append(step)
                        last = step
                    else:
                        parsed['steps'][-1] += ' ' + step
                        last = parsed['steps'][-1]
        # strip leading category word from title (e.g. 'Cookies Eggnog Cookies')
        t = parsed['title'].strip()
        for prefix in BELCHER_CATEGORY_PREFIX:
            if t.lower().startswith(prefix + ' '):
                parsed['title'] = t[len(prefix):].strip()
                parsed['category_hint'] = prefix
                break
        yield parsed


# --- Carl Preston: Baking Basics, one file per recipe ---
def extract_preston(book):
    docs = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))
    # recipe docs are text/partNNNN.html
    recipe_docs = []
    for item in docs:
        name = item.get_name()
        if not re.match(r'text/part\d{4}\.html', name):
            continue
        recipe_docs.append(item)
    recipe_docs.sort(key=lambda it: it.get_name())
    for item in recipe_docs:
        soup = BeautifulSoup(item.get_content(), 'html.parser')
        for tag in soup(['script', 'style']):
            tag.decompose()
        # content sits in <div>/<ol>/<li> etc., so flatten body text line-by-line
        paras = [l.strip() for l in soup.get_text('\n', strip=True).split('\n') if l.strip()]
        if not paras:
            continue
        title = paras[0]
        # find Ingredients / Method boundaries
        ing_start = None
        method_start = None
        for i, p in enumerate(paras):
            if p.lower().strip() == 'ingredients' and ing_start is None:
                ing_start = i + 1
            if p.lower().strip().startswith('method'):
                method_start = i + 1
                break
        if ing_start is None:
            continue
        if method_start is None:
            continue
        ingredients = []
        for p in paras[ing_start:method_start]:
            for ing in split_ingredient_lines(p):
                if looks_like_ingredient(ing):
                    ingredients.append(ing)
        steps = []
        last = None
        for p in paras[method_start:]:
            step = strip_step_number(p)
            if re.match(r'^\d+[.)]', p) or last is None:
                steps.append(step)
                last = step
            else:
                steps[-1] += ' ' + step
                last = steps[-1]
        yield {'title': title, 'description': '', 'prep': None, 'cook': None,
               'servings': None, 'ingredients': ingredients, 'steps': steps}


# --- Richard Gant: Baking Bible, messy OCR ---
def extract_gant(book):
    entries, _ = get_outline(book)
    recipes = []
    for docname, aid, title in entries:
        tl = title.strip().lower()
        if tl in ('free book', 'breads', 'cakes', 'pies', 'fruitcakes & other holiday favorites',
                  'fillings, frostings & glazes'):
            continue
        if too_long_for_title(title) or too_short_for_title(title):
            continue
        recipes.append((docname, aid, title))
    for title, body in recipe_bodies(book, recipes):
        parsed = {'title': title, 'description': '', 'prep': None, 'cook': None,
                  'servings': None, 'ingredients': [], 'steps': []}
        section = 'description'
        for para in body:
            low = para.strip().lower()
            if low.startswith('serves') or low.startswith('yield') or low.startswith('serving'):
                parsed['servings'] = parse_servings(low)
                section = 'ingredients'
                continue
            if section != 'directions' and is_method_start(para):
                # method paragraph (ALL CAPS run-on)
                section = 'directions'
                step = sentence_case(repair_text(para))
                parsed['steps'].append(step)
                continue
            if section == 'description':
                parsed['description'] += (' ' + para).strip()
            elif section == 'ingredients':
                for ing in split_ingredient_lines(para):
                    ing2 = repair_text(ing)
                    ing2 = fix_word_amounts(ing2)
                    if looks_like_ingredient(ing2):
                        parsed['ingredients'].append(ing2)
                    elif len(ing2) < 60 and ing2:
                        parsed['ingredients'].append(ing2)
            else:  # directions
                step = sentence_case(repair_text(para))
                parsed['steps'].append(step)
        # description may be empty -> leave empty, normalize() will fill
        yield parsed


# --- FB2: Paula Isabella, 30 cookie recipes ---
FB2_LABELS = {'ingredients', 'directions', 'check out my books', 'before you leave',
              'free gift', 'summary', 'introduction', 'techniques', 'equipment needed',
              'disclaimer', 'important'}
FB2_CATEGORY_WORDS = {'cookies', 'shortbread', 'cupcakes', 'bars', 'biscuits', 'cakes'}
FB2_MARKETING_RE = re.compile(r'>>|click here|download|free gift|freebie|bonus book|www\.|http|\.com|'
                              r'anti-inflammatory|before you leave|check out my books|important|'
                              r'get it|i promise|redirected|at the end of the book', re.IGNORECASE)


def fb2_title_like(t):
    return (t.isupper() and 3 <= len(t) <= 60 and not re.search(r'\d|[!>|]', t)
            and t.lower().strip() not in FB2_LABELS and t.lower().strip() not in FB2_CATEGORY_WORDS)


def fb2_is_recipe_title(t):
    """Real recipe titles mention cookies/bars/cups; sub-section labels (Icing,
    Coating, Frosting, Caramel...) do not and are merged into the current recipe."""
    if not fb2_title_like(t):
        return False
    low = t.lower()
    return any(w in low for w in ('cookie', 'cookies', 'bar', 'bars', 'cup', 'cups', 'cereal'))


def extract_fb2(path):
    tree = ET.parse(path)
    root = tree.getroot()
    ns = '{http://www.gribuser.ru/xml/fictionbook/2.0}'
    body = root.find(ns + 'body')
    lines = []
    for sec in body.findall(ns + 'section'):
        for p in sec.iter(ns + 'p'):
            txt = ' '.join(p.itertext())
            for frag in txt.split('\n'):
                frag = frag.strip()
                if frag:
                    lines.append(frag)

    # start at the first title-like line that is followed by INGREDIENTS (first recipe)
    start = None
    for i in range(len(lines) - 1):
        if fb2_title_like(lines[i]):
            for j in range(i + 1, min(i + 4, len(lines))):
                if lines[j].lower().strip() == 'ingredients':
                    start = i
                    break
            if start is not None:
                break
    if start is None:
        return

    recipes = []
    current = None
    mode = 'ingredients'
    for t in lines[start:]:
        low = t.lower().strip()
        if FB2_MARKETING_RE.search(t):
            continue
        if low == 'ingredients':
            mode = 'ingredients'
            continue
        if low == 'directions':
            mode = 'directions'
            continue
        if low in FB2_CATEGORY_WORDS or low in FB2_LABELS:
            continue
        if fb2_title_like(t):
            if fb2_is_recipe_title(t):
                # new recipe title
                if current and (current['ingredients'] or current['steps']):
                    recipes.append(current)
                current = {'title': t.title(), 'description': '', 'prep': None, 'cook': None,
                           'servings': None, 'ingredients': [], 'steps': []}
                mode = 'ingredients'
            # sub-section label (Icing, Frosting, ...): skip; its content merges
            continue
        if current is None:
            continue
        if mode == 'ingredients':
            if looks_like_ingredient(t) or (len(t) < 60 and not t.isupper()):
                current['ingredients'].append(t)
        elif mode == 'directions':
            current['steps'].append(t)
    if current and (current['ingredients'] or current['steps']):
        recipes.append(current)
    for r in recipes:
        r['category_hint'] = 'cookies'
        yield r


# ============================================================
# Normalization
# ============================================================

def split_amount_name(line):
    """'2 cups heavy cream' -> ('2 cups', 'heavy cream')."""
    line = line.strip()
    if not line:
        return ('', '')
    m = re.match(
        r'^((?:' + AMT_TOKEN + r')(?:\s*(?:to|–|-)\s*(?:' + AMT_TOKEN + r')|'
        r'\s+(?:' + AMT_TOKEN + r'))*'
        r'(?:\s+(?:' + '|'.join(re.escape(u) for u in sorted(UNIT_WORDS, key=len, reverse=True)) + r'))?)'
        r'\s+(?P<name>.+)$', line, re.IGNORECASE)
    if m:
        # amount is everything before name; drop the trailing 'and'/'of'
        amt = line[:line.index(m.group('name'))].strip()
        amt = re.sub(r'\s*(?:of|and)\s*$', '', amt)
        return (amt, m.group('name'))
    return ('', line)


def slugify(title, taken):
    base = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    base = re.sub(r'-+', '-', base)
    if not base:
        base = 'recipe'
    slug = base
    n = 2
    while slug in taken:
        slug = f'{base}-{n}'
        n += 1
    taken.add(slug)
    return slug


def normalize(raw, used_slugs, seen_titles, fallback_category='desserts'):
    title = raw['title'].strip()
    if not title:
        return None
    norm_title = re.sub(r'[^a-z0-9]+', ' ', title.lower()).strip()
    if not norm_title or norm_title in seen_titles:
        return None
    seen_titles.add(norm_title)

    category = raw.get('category_hint')
    if category:
        category = category.lower()
    else:
        category = infer_category(title)
    # book category words -> canonical site categories
    category = CATEGORY_ALIASES.get(category, category)

    prep = raw.get('prep') or 0
    cook = raw.get('cook') or 0
    total = prep + cook
    if not total:
        d = TIME_DEFAULTS.get(category, TIME_DEFAULTS['desserts'])
        prep, cook = d
        total = prep + cook

    servings = raw.get('servings') or 4
    if servings < 1:
        servings = 4

    description = raw.get('description') or gen_description(category, title)

    ingredients = []
    for line in raw['ingredients']:
        line = repair_text(line)
        line = fix_word_amounts(line)
        amt, name = split_amount_name(line)
        if not name:
            name = line
        ingredients.append({'amount': amt, 'name': name})

    steps = []
    for s in raw['steps']:
        s = repair_text(s).strip()
        if not s:
            continue
        if len(s) > 500:
            # split long run-on into sentences
            parts = re.split(r'(?<=[.!?])\s+', s)
            for part in parts:
                if part.strip():
                    steps.append({'text': part.strip(), 'timerMinutes': None})
        else:
            steps.append({'text': s, 'timerMinutes': None})

    if not ingredients or not steps:
        return None

    return {
        'id': slugify(title, used_slugs),
        'title': title,
        'image': PLACEHOLDER_IMG,
        'category': category,
        'prepTime': prep,
        'cookTime': cook,
        'servings': servings,
        'difficulty': difficulty_from(total),
        'description': description,
        'ingredients': ingredients,
        'steps': steps,
    }


# ============================================================
# Main
# ============================================================

def main():
    epub_files = sorted(glob.glob(os.path.join(SRC_DIR, '*.epub')),
                        key=lambda f: os.path.basename(f).lower())
    fb2_files = glob.glob(os.path.join(SRC_DIR, '*.fb2'))

    # quality order: cleanest sources first so they win dedup
    by_name = {}
    for f in epub_files:
        name = os.path.basename(f).lower()
        if '1001' in name:
            by_name['katie'] = (f, extract_katie)
        elif '214' in name:
            by_name['cotet'] = (f, extract_cotet)
        elif '350' in name:
            by_name['belcher'] = (f, extract_belcher)
        elif 'baking basics' in name or 'top baking recipes' in name:
            by_name['preston'] = (f, extract_preston)
        elif 'baking bible' in name:
            by_name['gant'] = (f, extract_gant)
    # cleanest -> messiest
    order = ['katie', 'preston', 'fb2', 'cotet', 'belcher', 'gant']

    used_slugs = set()
    seen_titles = set()
    all_recipes = []
    stats = {}

    for key in order:
        count = 0
        raw_count = 0
        if key == 'fb2':
            for f in fb2_files:
                for raw in extract_fb2(f):
                    raw_count += 1
                    rec = normalize(raw, used_slugs, seen_titles)
                    if rec:
                        all_recipes.append(rec)
                        count += 1
        else:
            if key not in by_name:
                continue
            f, fn = by_name[key]
            book = epub.read_epub(f)
            for raw in fn(book):
                raw_count += 1
                rec = normalize(raw, used_slugs, seen_titles)
                if rec:
                    all_recipes.append(rec)
                    count += 1
        stats[key] = {'raw': raw_count, 'kept': count}
        print(f'  {key:9s} raw={raw_count:5d} kept={count:5d}')

    print('\nTotal recipes kept:', len(all_recipes))
    cats = {}
    for r in all_recipes:
        cats[r['category']] = cats.get(r['category'], 0) + 1
    print('Categories:', json.dumps(cats, indent=0))

    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump({'recipes': all_recipes}, fh, ensure_ascii=False, indent=2)
    print(f'\nWrote {OUT}')


if __name__ == '__main__':
    main()
