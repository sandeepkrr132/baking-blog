# Sweet Crumbs Baking Blog

Full-stack baking blog with Vercel (hosting) + Supabase (database, auth).

## Stack

- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Backend**: Supabase (Postgres DB, Google OAuth)
- **Hosting**: Vercel (static site)
- **Fonts**: Playfair Display + Inter

## Key Files

- `index.html` — Homepage with recipe grid
- `recipe.html` — Single recipe view with timers
- `login.html` — Google OAuth login
- `script.js` — Recipe loading, timers, UI logic
- `auth.js` — Supabase auth (Google OAuth, session management)
- `styles.css` — All styling
- `recipes.json` — Seed data (recipes also stored in Supabase)

## Supabase Config

- Project: `bynfesgbvgcmkpnwysil`
- Auth: Google OAuth only
- Data: `recipes` table accessed via REST API

## Development

This is a static site — no build step. Edit HTML/CSS/JS directly.
Deployed automatically via Vercel Git integration.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
