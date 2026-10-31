# DahliaSeedling

A community and continuation platform for genetically unique dahlias grown from seed.

> **Phase status**
>
> Implemented: **Phase 0 — Foundation**.
>
> Phase 1 (Identity & App Shell) has **not** been implemented.

The product specifications are the Word documents and `DahliaSeedling_Backlog.md` in the repository root. They are the source of truth. Where this README and those documents disagree, the documents win.

---

## Prerequisites

| Tool    | Version                           | Notes                                                                             |
| ------- | --------------------------------- | --------------------------------------------------------------------------------- |
| Node.js | 22.12 or newer (`.nvmrc` pins 22) | Includes npm. Use `nvm use` if you use nvm.                                       |
| npm     | Ships with Node                   | The project is locked to npm (`package-lock.json`).                               |
| Docker  | A running daemon                  | Needed only for the local Supabase stack. Docker Desktop or a compatible runtime. |
| Git     | Any recent version                |                                                                                   |

The Supabase CLI is a dev dependency, so you do not install it globally. Run it through the npm scripts or with `npx supabase`.

## Installation

```bash
git clone <repository-url> dahliaseedling
cd dahliaseedling
npm ci
```

`npm ci` installs exactly what `package-lock.json` records. Use it on a fresh clone.

## Environment setup

Configuration comes from environment variables. Copy the template and fill in the values:

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored. Never commit it, and never paste real keys into `.env.example`.

| Variable                               | Browser-safe?        | Required to boot? | Purpose                                                                 |
| -------------------------------------- | -------------------- | ----------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes                  | Yes               | Supabase API URL. Local default `http://127.0.0.1:54321`.               |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes                  | Yes               | Supabase publishable key. Protected by RLS, so exposing it is expected. |
| `SUPABASE_SECRET_KEY`                  | **No (server only)** | No                | Not read by Phase 0 code. Never prefix with `NEXT_PUBLIC_`.             |

If a required variable is missing or malformed, the app still serves pages, and `/api/health` returns `503` naming the variables. It never prints their values.

## Development

```bash
npm run dev
```

Open <http://localhost:3000>. The page confirms the foundation, the design tokens and the typography.

## Supabase (local development)

The local stack runs the same Postgres, Auth, Storage and API services as the hosted platform, in Docker.

```bash
npm run supabase:start    # start the local stack (first run downloads images)
npm run supabase:status   # print the API URL and keys for .env.local
npm run supabase:stop     # stop the stack; data persists in Docker volumes
```

Copy the API URL and the publishable key from `supabase:status` into `.env.local`.

## Migrations

All schema changes live in `supabase/migrations/` as version-controlled SQL. The hosted database is never changed by hand.

```bash
npm run db:migration:new -- <short_description>   # create supabase/migrations/<timestamp>_<short_description>.sql
npm run db:reset                                    # rebuild the local DB from empty, applying every migration and seed.sql
```

Edit the new file, then run `npm run db:reset` to verify it applies from an empty database. Commit the migration together with its tests.

Phase 0 creates **no application tables**. The migration mechanism is established and verified, and the first real migration arrives with Phase 1.

### Database conventions

These rules apply to every migration from now on:

1. **RLS is created with the table.** Each `create table` is followed, in the same file, by `alter table ... enable row level security` and the policies. Security is never postponed.
2. **Grants are explicit.** `supabase/config.toml` sets `auto_expose_new_tables = false`, so a new table is invisible to the Data API until its migration grants access.
3. **No dashboard-only schema changes.** Anything changed in a hosted dashboard is not in version control and must be reproduced as a migration.
4. **Seed data is synthetic.** `supabase/seed.sql` may contain only synthetic development data, never real grower, message or location data.

`tests/supabase/conventions.test.ts` enforces rules 1, 2 and the config setting, so a violating migration fails `npm test`.

## Quality checks

| Command                | What it checks                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run lint`         | ESLint (Next.js core web vitals and TypeScript rules).                                              |
| `npm run typecheck`    | Strict TypeScript, with no emitted output.                                                          |
| `npm run format:check` | Prettier formatting. Use `npm run format` to fix.                                                   |
| `npm test`             | Vitest baseline tests: configuration, health, design tokens and contrast, and database conventions. |
| `npm run build`        | Production build.                                                                                   |
| `npm run check`        | Lint, typecheck, format check and tests in one command.                                             |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, format check, tests and build on every pull request. A separate job starts a local Supabase stack and runs `supabase db reset`, which proves every migration applies from empty.

## Health / status

```
GET /api/health
```

- `200` with `{ "status": "ok", ... }` when configuration is present and well-formed.
- `503` with `{ "status": "error", "problems": { "missing": [...], "invalid": [...] } }` otherwise.

The check makes no network calls, so a Supabase outage never makes the app look dead.

## Deployment

The app is designed for **Vercel + Supabase**. No credentials are stored in this repository.

### Vercel

1. Import the repository in Vercel. Next.js is detected automatically; no `vercel.json` is needed.
2. Node version comes from `.nvmrc` and the `engines` field.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **separately for each environment**:
   - **Preview** (per branch or PR): a non-production Supabase project with synthetic data.
   - **Production**: the production Supabase project only.
4. Do not give `SUPABASE_SECRET_KEY` a `NEXT_PUBLIC_` name, and do not expose it to the Preview environment unless a server route needs it.

### Supabase

Create separate Supabase projects for **development**, **preview/staging** and **production**. Link the CLI to a project only when you are ready to push migrations, and use the same migration files for every environment. Hosted-project migration automation is **not configured yet** (see Open issues).

## Architecture

DahliaSeedling is a **modular monolith**: one deployable Next.js application, one PostgreSQL database, and clearly separated internal modules. Microservices are deliberately not used.

| Area             | Location                                                      | Rule                                                                                            |
| ---------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Routes and pages | `src/app/`                                                    | Thin. They call domain functions and render results.                                            |
| UI components    | `src/design-system/components/` and future feature components | Presentation only. No database or domain logic.                                                 |
| Design tokens    | `src/design-system/`                                          | Raw HEX values live **only** in `tokens.css`. Components use semantic aliases from `theme.css`. |
| Configuration    | `src/lib/config/`                                             | Typed, validated environment access.                                                            |
| Health           | `src/lib/health/`                                             | Status logic, separate from the route handler.                                                  |
| Copy             | `src/content/strings.ts`                                      | All application-facing text, ready for future translation.                                      |
| Database         | `supabase/`                                                   | Migrations, config and seed data.                                                               |
| Tests            | `src/**/*.test.ts` and `tests/`                               | Unit tests live beside code. Repository-level guards live in `tests/`.                          |

**Rule for later phases:** domain operations (creating Seedlings, publishing Updates, confirming a Rehome, and so on) live in server-side domain modules and server actions or route handlers. They do not live inside React components, because they must be testable without rendering and enforceable at the database boundary. Modules for Seedlings, Capture, Publications, Rehome, Seeds, Messaging, Notifications and Moderation are added in their phases, not before.

## Design system

- **Palette:** Aubergine `#382733`, Apricot `#F29B72`, Muted Plum `#8B6177`, Porcelain `#FBF7F1`, Sand `#E8DDD2`, Charcoal `#29272A`, all defined in `src/design-system/tokens.css`.
- **Typography:** DM Sans for interface text; Fraunces only for the wordmark and selected display moments. Both are self-hosted by `next/font`.
- **Accessibility:** visible focus rings on every focusable element, 44 px minimum touch targets on controls, semantic HTML, and respect for reduced-motion preferences.
- **Contrast:** text pairs are tested against WCAG AA in `tests/design-system/tokens.test.ts`. Apricot is never used for text, and primary actions use dark text on Apricot.
- **Out of scope for MVP:** dark mode, a permanent logo, and the Cull/continuation symbol.

## Project layout

```
src/
  app/                  routes, layout, global CSS, /api/health
  design-system/        tokens, semantic theme, fonts, primitives
  content/              application copy
  lib/config/           typed environment configuration
  lib/health/           health status logic
tests/                  repository-level guards (design tokens, Supabase conventions)
supabase/               local Supabase config, migrations, seed data
.github/workflows/      CI
```

## Source documents

- Domain Architecture Specification v1.0 (locked baseline)
- Technical Requirements Document v1.0
- Data Model + Permissions Specification v1.0
- App Flow & UX Specification v1.0
- Design System & UI Brief v1.0
- MVP Implementation Plan v1.0
- Post-MVP Backlog (`DahliaSeedling_Backlog.md`)

**Discovery:** the MVP has no separate Explore destination. Discovery lives inside Home through the Feed, Search and lightweight discovery filters.

**Specifications:** the locked specifications listed above are the source of truth. If a future requirement is not covered by them, it is raised as a specific decision rather than assumed.
