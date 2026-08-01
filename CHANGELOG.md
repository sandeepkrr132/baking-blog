# Changelog

Live site: https://baking-blog-three.vercel.app
Stack: static vanilla HTML/CSS/JS on Vercel + Supabase (`bynfesgbvgcmkpnwysil`)

---

## [2026-08-01] Auth fix (migrate to supabase-js) + Create Recipe wizard

### Auth / JWT fix — root cause
Signed-in features ("Failed to load your recipes", "JWT expired" on the create form, failed photo uploads, "Could not update saved state") were all the same bug: the site hand-rolled JWT handling in `auth.js` (raw `fetch` + `localStorage` `sb-access-token`/`sb-refresh-token`) and **never refreshed expired tokens**. GoTrue rejects an expired token on `/auth/v1/user` with **HTTP 403**, but the refresh-on-failure code only checked for **401**, so it silently fell back to decoding the dead JWT — the UI thought you were logged in while every authenticated REST call failed with `JWT expired`. Confirmed via Supabase auth logs: dozens of `bad_jwt` 403s on `/user`, zero successful refresh grants.

- **`supabase.js` (new)** — vendored `@supabase/supabase-js` **2.111.0** UMD bundle (global `supabase`), so a no-build static site gets the official client without a CDN dependency.
- **`auth.js`** — rewritten around `supabase.createClient({ auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } })`. The client now owns access-token refresh + rotation, session persistence, and `onAuthStateChange` (redirect to login only on a genuine `SIGNED_OUT` on a protected page; `TOKEN_REFRESHED` is silent). `getCurrentUser()` uses `getUser()` (server-verified). Old legacy token keys are cleared.
- **`script.js`** — every data/storage call converted to `supabaseClient.from(...)` / `.storage.from(...)`, which attach the session token and refresh+retry on 401. Added `redirectIfSignedOut()` so only a genuinely invalid session sends users to login; transient failures show a friendly message.
- **`login.html` / `auth-callback.html`** — use the client's `signInWithPassword` / `signUp` / `signInWithOAuth` and `getSession()` for the OAuth callback.
- All pages (incl. the 4 regenerated static recipe pages) load `supabase.js` before `auth.js`.
- Users sign in once more after this deploy (old tokens can't be ported).

### Create Recipe redesigned as a 6-step wizard
`create-recipe.html` is now a step-by-step flow instead of one long form:

1. **Basics** — title, category, difficulty
2. **Details** — prep/cook time, servings, public/private
3. **Photo & Description** — upload + description
4. **Ingredients** — dynamic rows
5. **Steps** — dynamic rows with optional timer (min + label)
6. **Review & Create** — summary of everything entered + the Create Recipe button

Includes a stepper progress bar ("Step 3 of 6"), Back/Next with **per-step validation** (no moving on without a title/ingredients/steps), and all entered data preserved when navigating back. Edit mode (`?id=…`) prefills the wizard. Same warm/cream Sweet Crumbs styling.

### Tooling
- **`_e2e.js`** updated for the new auth + wizard: logs in through the real login UI (the old localStorage token injection no longer applies) and walks the wizard for create/edit.

---

## [2026-08-01] Nav cleanup

The top nav was cramped — links ran together ("Saved My Recipes" read as one phrase), "+ Create" was plain text, and at small widths the header stacked vertically instead of collapsing.

- **`styles.css`** — rebuilt the header/nav on an **8pt grid**:
  - Every `.nav-link` has its own pill padding (`8px 12px`) with `4px` gaps, so items read as distinct targets.
  - Subtle **glassmorphic hover**: `background: rgba(61,43,31,0.06)` + `backdrop-filter: blur(6px)`, rounded pill. Tinted warm (not pure white) so it's actually visible on the white/cream header.
  - **"+ Create"** is now a compact primary accent button (`.btn .btn-primary .nav-create`, pill radius, `8px 16px`) matching the homepage "Browse Recipes" style; it stays top-right on every page.
  - User menu (avatar/name/sign out) and the Sign In button restyled to match.
  - **Mobile ≤1080px**: nav collapses into a hamburger. The bar keeps the logo, "+ Create" and the avatar; Home/Recipes/About/Saved/My Recipes + a "Sign out" row live in the dropdown. Toggle animates to an ✕; menu closes on link tap, outside tap, or Escape.
- **`script.js`** — `renderAuthNav()` now splits the signed-in nav into `#authNav` (Saved / My Recipes, inside the hamburger) and `#authActions` ("+ Create" + avatar, always visible). Added `setupNavToggle()` for the hamburger (with `aria-expanded`).
- **Pages** — `index.html`, `recipe.html`, `my-recipes.html`, `saved.html`, `create-recipe.html` headers got `id="siteNav"`, a `#authActions` slot, and the `#navToggle` button; 4 static recipe pages regenerated.
- Breakpoint: full inline nav at ≥1081px; hamburger below. Verified headless (Playwright): desktop spacing/actions + mobile toggle/close behavior all pass.

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
