# Sweet Crumbs Baking Blog — Full Setup Guide

> A complete walkthrough of building a baking blog with Supabase, Google Auth, and Vercel deployment.

---

## What We Built

A baking blog (**Sweet Crumbs**) that:
- Stores recipes in a **Supabase** (PostgreSQL) database
- Fetches recipes via **Supabase REST API** (PostgREST)
- Supports **Google OAuth** login via Supabase Auth
- Is deployed on **Vercel** with automatic deployments
- Has built-in cooking **timers** with audio alerts

**Live site:** https://baking-blog-three.vercel.app

---

## Step 1: Supabase Project Setup

### Create Project
- **Project name:** `baking-blog-recipes`
- **Region:** `ap-south-1`
- **Project ID:** `bynfesgbvgcmkpnwysil`
- **URL:** `https://bynfesgbvgcmkpnwysil.supabase.co`
- **Status:** ACTIVE (free tier)

### Create Recipes Table

```sql
create table recipes (
  id text primary key,
  title text not null,
  image text,
  category text not null,
  "prepTime" integer not null,
  "cookTime" integer not null,
  servings integer not null,
  difficulty text not null,
  description text,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table recipes enable row level security;

-- Public read access (blog is public)
create policy "Public read access" on recipes
  for select using (true);
```

### Grant Data API Access

```sql
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
```

### Seed Data

4 recipes were seeded:
| ID | Title | Category |
|---|---|---|
| `chocolate-chip-cookies` | Classic Chocolate Chip Cookies | cookies |
| `vanilla-cupcakes` | Fluffy Vanilla Cupcakes | cakes |
| `sourdough-bread` | Rustic Sourdough Bread | bread |
| `banana-bread` | Moist Banana Bread | cakes |

### API Keys

- **Anon Key (public):** Used in frontend JavaScript
- **Project URL:** `https://bynfesgbvgcmkpnwysil.supabase.co`

> ⚠️ The anon key is safe to use in frontend code — RLS policies protect the data.

---

## Step 2: Frontend — Supabase Integration

### How the Frontend Fetches Data

**`auth.js`** — Contains Supabase config + auth functions:
```js
const SUPABASE_URL = 'https://bynfesgbvgcmkpnwysil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

**`script.js`** — Fetches recipes via REST API:
```js
async function fetchRecipes() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/recipes?select=*`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    return await response.json();
}
```

### Key Learning: Supabase REST API
- **Endpoint:** `{SUPABASE_URL}/rest/v1/{table}?select=*`
- **Headers required:** `apikey` and `Authorization` (both use the anon key)
- **RLS policies** control which rows are visible
- **Data API grants** control whether the table is accessible at all

---

## Step 3: Vercel Deployment

### Project Config
- **Project ID:** `prj_Tn5Grdcjfm8csMr55dpl9z6xqmnL`
- **Alias:** `baking-blog-three.vercel.app`
- **Auto-deploy:** Every `git push` or `vercel --prod` triggers a build

### Deploy Command
```bash
cd baking-blog
npx vercel --prod --yes
```

---

## Step 4: Google OAuth Setup

### Part A — Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → APIs & Services → OAuth consent screen (External)
3. Create OAuth Client ID:
   - **Type:** Web application
   - **Redirect URI:** `https://bynfesgbvgcmkpnwysil.supabase.co/auth/v1/callback`
4. Copy **Client ID** + **Client Secret**

### Part B — Supabase Dashboard

1. Go to Auth → Providers → Google
2. Paste Client ID and Client Secret
3. Save

### Part C — Redirect URLs (Important!)

In Supabase Dashboard → Auth → URL Configuration:
- **Remove** any `localhost` entries
- **Add:** `https://baking-blog-three.vercel.app/**`

### How Google Auth Works (Flow)

```
User clicks "Sign In with Google"
  → Browser navigates to Supabase /auth/v1/authorize?provider=google
    → Supabase redirects to Google OAuth
      → User logs in with Google
        → Google redirects back to Supabase callback
          → Supabase exchanges code for tokens
            → Supabase redirects to auth-callback.html#access_token=...
              → Frontend stores tokens in localStorage
                → Redirects to index.html
                  → Header shows user name + avatar
```

### Auth Code Structure

**`auth.js`** handles:
- `signInWithGoogleProvider()` — Redirects to Supabase auth URL
- `handleAuthCallback()` — Extracts tokens from URL hash, stores in localStorage
- `getCurrentUser()` — Fetches user from API, with JWT decode fallback
- `refreshSession()` — Refreshes expired tokens
- `signOut()` — Clears tokens, redirects to home

---

## Step 5: Bugs We Fixed

### Bug 1: Broken Images
**Problem:** Vanilla cupcakes and banana bread images returned 404 from Unsplash.
**Fix:** Replaced with working Unsplash photo IDs:
- Cupcakes: `photo-1576618148400-f54bed99fcfd`
- Banana bread: `photo-1606313564200-e75d5e30476c`

### Bug 2: Google Auth Redirect to localhost
**Problem:** After Google login, browser redirected to `localhost:3000` instead of production.
**Fix:** Hardcoded production URL in auth redirect:
```js
const PROD_URL = 'https://baking-blog-three.vercel.app';
```
Also removed `localhost:3000` from Supabase redirect URLs.

### Bug 3: Duplicate Variable Declaration (Critical!)
**Problem:** Both `auth.js` and `script.js` declared `const SUPABASE_URL` and `const SUPABASE_ANON_KEY`. This caused:
```
Identifier 'SUPABASE_URL' has already been declared
```
This JavaScript error **crashed the entire script** — no recipes loaded, no auth worked.

**Fix:** Removed the duplicate declarations from `script.js`, keeping them only in `auth.js`.

**Lesson:** When loading multiple `<script>` tags, `const` declarations share the same scope. Duplicate `const` = TypeError.

### Bug 4: User Profile Not Showing
**Problem:** After login, the header didn't show the user's name/avatar.
**Fix:** Supabase returns `raw_user_meta_data` (not `user_metadata`) from the `/auth/v1/user` endpoint. Updated code to check both:
```js
const meta = user.user_metadata || user.raw_user_meta_data || {};
```
Also added JWT decode fallback for when the API call fails.

---

## Step 6: Playwright MCP (Browser Automation)

### The Problem
The `browsing-with-playwright` skill uses shell scripts (`mcp-client.py`) that create a **new HTTP session** for each call. The `Mcp-Session-Id` is lost between invocations, so the browser page context is lost — resulting in blank screenshots.

### The Fix
Registered Playwright as a proper MCP server in `.mcp.json`:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**Why this works:**
- Shell script approach: New HTTP session per call → context lost
- MCP server approach: Persistent stdio connection → context maintained

---

## File Structure

```
baking-blog/
├── index.html          # Homepage with recipe grid
├── recipe.html         # Individual recipe page with timers
├── login.html          # Google OAuth login page
├── auth-callback.html  # OAuth redirect handler
├── script.js           # Recipe fetching, rendering, timers
├── auth.js             # Supabase auth (Google OAuth)
├── styles.css          # All styling
├── recipes.json        # Original static data (now unused)
├── SETUP-GUIDE.md      # This file
└── .vercel/            # Vercel project config
```

---

## Step 7: OmniRoute (AI Gateway / API Proxy)

### What is OmniRoute
- Free AI gateway that proxies requests to 36+ providers
- Used with Claude Code to route through OAuth authentication
- Dashboard: `http://localhost:20128`
- GitHub: https://github.com/pitbaden/omniroute

### OmniRoute + Claude Code
- OmniRoute handles OAuth token management for Claude Code
- Tokens auto-refresh in background before expiration
- If token refresh gets stuck → 401 error on Claude Code terminal

### Fixing OmniRoute 401 Errors
When Claude Code shows `401: You need to sign in to use this model`:

1. Open OmniRoute dashboard: `http://localhost:20128`
2. Go to **Providers**
3. Find the Claude/Anthropic provider
4. Click **Reconnect** — or delete and re-add it
5. Restart Claude Code terminal

> From OmniRoute docs: "OAuth token expired. Auto-refreshed; if stuck, delete + re-auth in Providers."

### OmniRoute Config
- Stored in `~/.omniroute/`
- Data directory can be overridden with `DATA_DIR` env var
- Login password set via `INITIAL_PASSWORD` env var

---

## Key Takeaways

1. **Supabase REST API** is just HTTP GET with an API key header — no SDK needed for simple cases
2. **RLS policies** are critical — without them, your data is exposed
3. **Data API grants** are separate from RLS — both must be configured
4. **Google OAuth redirect URIs** must exactly match — even trailing slashes matter
5. **`const` in multiple `<script>` tags** share scope — avoid duplicates
6. **Supabase user metadata** uses `raw_user_meta_data` from the API, not `user_metadata`
7. **JWT tokens** contain user data — useful as a fallback when API calls fail
8. **MCP servers** with stdio transport maintain persistent connections — HTTP transport does not
9. **OmniRoute OAuth tokens** auto-refresh but can get stuck — reconnect in dashboard Providers page
10. **Browser automation** (Playwright) needs persistent MCP connections, not per-call HTTP sessions

---

## Session Summary

**Duration:** Single session
**Stack:** Supabase + Vercel + Google OAuth + OmniRoute + Playwright MCP
**Result:** Full-stack baking blog with database, auth, deployment, and browser testing capability

### Commands Cheat Sheet

```bash
# Deploy to Vercel
cd baking-blog && npx vercel --prod --yes

# Test Supabase API
curl "https://bynfesgbvgcmkpnwysil.supabase.co/rest/v1/recipes?select=id,title" \
  -H "apikey: YOUR_KEY" -H "Authorization: Bearer YOUR_KEY"

# Restart Playwright MCP (if using shell scripts)
bash ~/.claude/skills/browsing-with-playwright/scripts/stop-server.sh
bash ~/.claude/skills/browsing-with-playwright/scripts/start-server.sh

# OmniRoute dashboard
http://localhost:20128
```
