# Changelog

Live site: https://baking-blog-three.vercel.app
Stack: static vanilla HTML/CSS/JS on Vercel + Supabase (`bynfesgbvgcmkpnwysil`)

---

## [2026-07-31] Saved Recipes + User-Created Recipes

Signed-in users can now **save/favorite recipes** and **create, edit, and delete their own recipes**, with per-recipe **public/private** visibility and **image upload** to Supabase Storage. This is the groundwork for a future paid/selling layer — the ownership + visibility model is structured so a `price` field can be added without restructuring.

### Database (Supabase migration)

- `public.recipes`
  - Added `created_by uuid references auth.users(id)` — the owner (null for the 4 seed recipes).
  - Added `visibility text default 'public'` (`check in ('public','private')`).
  - Replaced the old single SELECT policy with:
    - **SELECT**: `visibility = 'public' OR created_by = auth.uid()`
    - **INSERT**: `created_by = auth.uid()`
    - **UPDATE / DELETE**: `created_by = auth.uid()`
- `public.saved_recipes` (new) — favorites
  - `user_id uuid`, `recipe_id text`, `created_at`, PK `(user_id, recipe_id)`.
  - RLS: owner-only SELECT / INSERT / DELETE (toggle = delete + insert, no UPDATE).
- Storage bucket `recipe-images` (public read, owner-write)
  - Upload/update/delete policies scoped to `(storage.foldername(name))[1] = auth.uid()`.

### Frontend

- **`auth.js`** — added `getAccessToken()` (reads `sb-access-token`).
- **`script.js`** — added authenticated helpers and wiring:
  - `getAuthHeaders`, `isRecipeSaved`, `toggleSave`, `initSaveButton`
  - `fetchSavedRecipes`, `fetchMyRecipes`, `createRecipe`, `updateRecipe`, `deleteRecipe`, `uploadRecipeImage`
  - Homepage query filters `visibility=eq.public`; card links route user-created recipes to the dynamic view (`recipe.html?id=…`) and seed recipes to their static pages.
  - `fetchRecipeById` now sends the user's token when signed in (owners can read their private recipes).
  - `renderAuthNav` shows `Saved` / `My Recipes` / `+ Create` links when signed in.
- **`build-recipes.js`** — generated static pages now include the save button in the hero.
- **New pages**
  - `create-recipe.html` — create/edit form (title, category, times, servings, difficulty, description, dynamic ingredients/steps with optional timers, image upload + preview, public/private toggle). Edit mode via `?id=…`.
  - `saved.html` — lists the user's bookmarked recipes.
  - `my-recipes.html` — lists the user's creations (public + private) with Edit and Delete actions.
- **`styles.css`** — `.save-btn` (with `.saved` state), `.my-recipe-actions`, `.my-action-btn`, `.my-action-delete`, plus the form styles in `create-recipe.html`.
- 4 static recipe pages regenerated with the save button.

### Bugs fixed during verification

1. **Image upload rejected by RLS** — the `x-upsert: true` header failed the storage policy's update-with-check path. Removed the header (filenames are already unique via `Date.now()` prefix).
2. **Saved / My Recipes pages showed the homepage grid** — both reused `id="recipeGrid"`, which makes `script.js` run `loadHomepage()` and overwrite the page. Gave them distinct ids (`savedRecipesGrid`, `myRecipesGrid`).
3. **Saved list always empty** — PostgREST returns a to-one embed (`recipes(*)`) as an **object**, not an array; `fetchSavedRecipes` now normalizes both shapes.

### Verification

- RLS tested via REST: anon can read public recipes but all writes are rejected; authenticated owner writes succeed.
- Full headless-browser E2E (Playwright) against the live site — all checks pass: save toggle, Saved page, create with image upload, homepage visibility, edit, private-hidden-from-homepage, delete. Test data cleaned up afterwards.

---

## [2026-07-31] Host recipe images locally (stop hotlinking Unsplash)

Downloaded all 4 recipe photos into the repo (`images/*.jpg`) and pointed every layer at them, removing the dependency on Unsplash CDN URLs (a broken photo was the original bug).

- `recipes.json` → `image` now `/images/<id>.jpg` (relative).
- Regenerated static recipe pages — hero uses relative paths; OG/Twitter/JSON-LD use absolute `https://baking-blog-three.vercel.app/images/<id>.jpg` (crawlers require absolute).
- Supabase `public.recipes` rows updated (`image`, `pinImage`).
- Commits: `c219efb`, `f42519b`.

---

## Older

- `1f85abc` → initial "Saved Recipes + User-Created Recipes" feature commit (superseded by the fixes above: `8b9a105`, `91b566a`, `f351dc9`).
- `f42519b` → broken-image fix + static page generation.
- `c219efb` → local image hosting.
- Earlier history → `ed8c8bc` (initial site).
