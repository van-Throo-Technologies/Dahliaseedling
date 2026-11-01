# DahliaSeedling

A community and continuation platform for genetically unique dahlias grown from seed.

> **Phase status**
>
> Implemented: **Phase 0 — Foundation**, **Phase 1 — Identity & App Shell** and **Phase 2 — Seedling Core**.
>
> Phase 3 (Capture & Observations) has **not** been started.

The product specifications in the repository root are the source of truth. They are not edited by the codebase. Where this README and those documents disagree, the documents win. The locked specifications are: Domain Architecture v1.0, PRD v1.0, TRD v1.0, App Flow & UX v1.0, Data Model + Permissions v1.0, Implementation Plan v1.0, Design System & UI Brief v1.0, and the Post-MVP Backlog.

The MVP is a **mobile-first Next.js web app**. Phones are the primary environment. The backend is Supabase (PostgreSQL, Auth, Storage), and it is written so a future native client could use the same backend. No native client exists.

---

## Prerequisites

| Tool    | Version                           | Notes                                                                     |
| ------- | --------------------------------- | ------------------------------------------------------------------------- |
| Node.js | 22.12 or newer (`.nvmrc` pins 22) | Includes npm.                                                             |
| Docker  | A running daemon                  | Needed for the local Supabase stack, the RLS tests and the browser tests. |
| Git     | Any recent version                |                                                                           |

The Supabase CLI and Playwright are dev dependencies. Run them through npm scripts or `npx`.

Install the Playwright browser once:

```bash
npx playwright install chromium
```

## Installation

```bash
git clone <repository-url> dahliaseedling
cd dahliaseedling
npm ci
```

## Environment setup

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored and must never be committed.

| Variable                               | Browser-safe?       | Required? | Purpose                                                                                                                                   |
| -------------------------------------- | ------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes                 | Yes       | Supabase API URL. Local default `http://127.0.0.1:54321`.                                                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes                 | Yes       | Publishable key. Protected by RLS, so exposing it is expected.                                                                            |
| `SUPABASE_SECRET_KEY`                  | **No, server only** | No        | Not read by application code. Only the test helpers use it, and they read it from `supabase status`. Never prefix it with `NEXT_PUBLIC_`. |

If configuration is missing, pages still render as a signed-out visitor, and `/api/health` returns `503` with the variable names (never the values).

## Development

```bash
npm run supabase:start    # start the local stack (first run downloads images)
npm run supabase:status   # prints API_URL and PUBLISHABLE_KEY for .env.local
npm run db:reset          # apply every migration and seed.sql from an empty database
npm run dev               # http://localhost:3000
```

## Supabase (local development)

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:stop     # keeps data in Docker volumes
```

## Migrations

All schema changes are version-controlled SQL in `supabase/migrations/`. Nothing is changed by hand in a dashboard.

```bash
npm run db:migration:new -- <short_description>   # creates a timestamped file
npm run db:reset                                    # rebuilds the local database from empty
npm run db:types                                    # regenerates src/lib/supabase/database.types.ts
```

Phase 1 adds two migrations:

- `identity_profiles`: the `profiles` table, its triggers, RLS and column-level grants.
- `identity_admin_and_avatars`: the `admin_users` table, `is_admin()`, `admin_set_suspended()`, and the `avatars` storage bucket with owner-only write policies.
- `identity_avatar_private_delivery`: makes the `avatars` bucket **private** and adds the read policy described under "Avatars".

Phase 2 adds `20261031233803_seedling_core`: the `series`, `cultivar_references`, `seedlings`, `seedling_identifiers`, `seedling_parentage` and `provenance_events` tables, their RLS and grants, the triggers that protect identity, and the domain functions listed under "Seedling core".

Phase 1 and 2 create **no** Capture, Observation, media, Update, comment, follow, message or notification tables.

### Database conventions

1. **RLS is created with the table**, in the same migration.
2. **Grants are explicit.** `supabase/config.toml` sets `auto_expose_new_tables = false`. A new table is invisible to the Data API until its migration grants access.
3. **Clients get column-level grants.** Protected columns (`id`, `is_suspended`, timestamps) are never granted to `anon` or `authenticated`.
4. **No dashboard-only schema changes.**
5. **Seed data is synthetic.**

`tests/supabase/conventions.test.ts` checks the first two rules as SQL text. `tests/db` checks what the database actually allows.

## Authentication

- **Method:** email and password through Supabase Auth. Social login is not built, because the specifications do not require it.
- **Sign-up** creates the auth user. The profile is then set up on a separate step (display name and country), so onboarding asks for nothing else.
- **Sessions** are stored in HTTP-only cookies managed by `@supabase/ssr`. `src/proxy.ts` refreshes them on each request. `getUser()` validates the session with Supabase Auth. `getSession()` is never used for decisions.
- **Redirects** after sign-in use `safeNextPath`, which only accepts same-site absolute paths.
- **Logout** is a server action that ends the session and returns to Home.

### Local settings

`supabase/config.toml` (local only):

- `enable_signup = true`
- `enable_confirmations = false`, so sign-up returns a session immediately
- `minimum_password_length = 8`

### Production configuration (manual, in the Supabase dashboard)

- Turn **on** email confirmation. The application already handles both cases (see `signUpAction`).
- Set the **Site URL** to the production origin, and add it, plus any preview origins, to the redirect allow-list.
- Configure a **custom SMTP provider**. Confirmation emails need one for production volume.
- Keep the minimum password length at 8 or more.

## Avatars

Avatars are **private storage objects**. No avatar is reachable by a permanent public URL.

- **Reading:** the browser requests `/avatars/<profileId>`. The route reads the profile with the caller's own session, then downloads the file with the same session. Visibility is therefore decided by RLS on both tables.
- **Visibility rule:** a file is readable only when it is the **current** `avatar_path` of a profile the reader may see, or when the reader owns it. Suspended owners keep access to their own avatar. Visitors and other users do not.
- **Replacement:** the new file is uploaded, the profile is updated, and then the previous file is deleted. Once the profile points at the new file, the old one stops matching and is unreadable, even if its deletion failed.
- **Upload rules:** owner-only, into a folder named after their user id. JPEG, PNG or WebP only, up to 2 MB.
- **Not supported:** direct storage URLs, signed URLs and image transformation. Signed URLs would stay valid after suspension until they expired.

## Participation gate

Browsing is open. Anything that creates or changes data goes through the gate, so the rule lives in one place:

```ts
// src/modules/identity/gate.ts
requireAccount(returnTo); // signed in, with a profile
requireParticipant(returnTo); // signed in, with a profile, and not suspended
```

A visitor is sent to sign in, then to profile setup if needed, then back to `returnTo`. For example, the Capture destination (`/capture`) calls `requireParticipant('/capture')`. Later features should call these functions too. Do not add ad-hoc login checks inside components.

Phase 1 gates these destinations: `/capture`, `/notifications`, `/inbox`, `/profile`, `/profile/edit`. The first three are placeholders that say the feature is not yet available.

## Profiles

Fields follow the Data Model specification: display name, avatar, country (ISO 3166-1 alpha-2), optional region or city, optional bio, and an optional account presentation label (`individual`, `breeder` or `farm`).

- The presentation label is **not an authorization role**. It changes the displayed label only.
- Public profiles are readable by anyone at `/profiles/<id>`, unless suspended.
- Suspended profiles are not found by visitors or other users. The owner can still see their own profile but cannot edit it, and they are told why.

## Admin access

Admin status is stored in `admin_users`, not on a profile.

- A user can read only their own admin row. No client can insert, update or delete admin rows.
- To grant admin, a privileged operator runs this in the SQL editor or with a privileged role. It is an operational data change, not a schema change:

  ```sql
  insert into public.admin_users (user_id) values ('<auth user uuid>');
  ```

- An admin suspends or reinstates a profile through `admin_set_suspended(profile_id, suspended)`. The function checks admin status itself. An admin interface is Phase 10; until then this is the only path.

Emergency suspension without a signed-in admin is a privileged SQL update of `profiles.is_suspended`. Record it.

## Seedling core (Phase 2)

A **seedling** is one genetically unique dahlia grown from seed. Its database uuid is its immutable internal identity. Every human-readable identifier is a label attached to that identity. Nothing else changes what the seedling is.

### Identity invariants

- The uuid is never reissued, and clients cannot choose or change it.
- The **originator** is set at creation and never changes. A trigger refuses any change.
- The **current holder** is the grower with management authority. At creation it is the originator. It changes only inside the future confirmed-continuation transaction, which sets a transaction flag. Nothing else can change it, not even a privileged session.
- Seedlings are never hard-deleted. Deleting one is refused by a trigger.
- A cull or continuation is not deletion. Phase 2 has no Cull state, and the schema leaves room for it.

### Identifiers

Each seedling has an automatic number, and may also have a Series identifier. The two are independent.

| Kind      | Format                                                 | Scope                                                       | Notes                                                                |
| --------- | ------------------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Automatic | `#1`, `#2`, … (stored as `1`, `2`)                     | Per grower                                                  | Always created at creation. Never reset annually or reused.          |
| Series    | Pattern filled in from the Series, such as `JV-26-001` | Per Series, and per cohort year when the pattern has `{YY}` | Created at creation, or added later with `attach_series_identifier`. |

**Series.** A grower creates one or more Series, each with a name of 1 to 8 letters or digits (`JV`, `VT`). The pattern is `NAME-{YY}-{NNN}` (year-based) or `NAME-{NNN}` (yearless). DahliaSeedling does not decide what a Series means, and no Series is seeded.

**Year (`{YY}`) comes from the seedling's first-grown year.** It is the year the seedling was first grown from seed. It is never the day the record was entered, and never the identifier allocation time. A seedling first grown in 2026 and entered in 2027 is `JV-26-…`.

**Sequence scope.**

- A year-based pattern counts per **Series and cohort year**. `JV-26-001`, `JV-26-002`, then the first 2027 seedling is `JV-27-001`. Concurrent allocations for one Series and year are serialised by an advisory lock on that pair, and retired numbers are counted, so none is reissued.
- A yearless pattern counts per **Series** for its lifetime, from a counter on the Series row, locked for each increment. `JV-001`, `JV-002`, …, whatever first-grown years the seedlings have.

**Missing first-grown year.** A seedling can always be created, and it always gets its automatic number. A year-based Series cannot be allocated without a first-grown year. The database refuses the combination with a message on the year field, so no seedling is created with a silently dropped Series. The user chooses "Automatic number only", or enters the year.

**Adding a Series identifier later.** `attach_series_identifier(seedling, series)` adds a Series identifier to a seedling the caller holds. It verifies Series ownership and the year requirement, allocates in the correct scope, and makes the new identifier the primary display identifier. It does not change the seedling's uuid, its automatic number, or any existing identifier. A seedling can have at most one identifier from each Series.

**Changing the first-grown year after allocation.** Existing identifiers are historical. Changing `first_grown_year` does **not** rename them: a seedling already numbered `JV-26-014` stays `JV-26-014` if its year is later edited to 2027. Only seedlings allocated afterwards use the new year. Correcting an erroneous identifier is a future identity-correction mechanism. It is not part of Phase 2.

**History and aliases.** Identifier values and owners are immutable, and identifier rows cannot be deleted. A retired identifier stays in the table with `is_retired_alias = true`. It is never issued again, and `public.resolve_own_identifier` still resolves it to its seedling. The merge operation that creates retirements is Phase 9.

### Privacy and access

- **Private** is the default. Only the current holder can manage a private seedling.
- **Public** is an explicit choice. Anyone can read a public seedling, its identifiers and its provenance, while its current holder's profile is not suspended.
- **The originator keeps read access** to a seedling they raised, even after the holder changes, and even when it is private under the later holder. This is **read access only**. The originator cannot edit the name, year or privacy; change parentage; allocate identifiers; change the holder; or do any other holder-only action. Holder authority stays with the current holder. The read rule is `seedlings_select_originator`, and every write rule still checks `current_holder_id`.
- **A suspended holder's public seedlings are not publicly visible.** Visitors and other ordinary users cannot reach them through public visibility. The holder keeps read access to their own records, and editing stays disabled. Suspension changes no data.
- A private seedling's existence is not revealed. A private seedling, a missing one and a malformed id all return 404.
- A parent link is shown only when the reader may see that parent. A private parent is not revealed by its uuid, identifier, name, or any placeholder.

### Parentage

Each seedling has up to two parent rows, a seed parent and a pollen parent. A row names exactly one of three things, enforced by a check constraint:

| State            | Stored as                                                                             |
| ---------------- | ------------------------------------------------------------------------------------- |
| Not recorded     | No row. Shown as "Not recorded yet".                                                  |
| Unknown          | `is_unknown = true`. Shown as "Unknown". Unknown is a statement, not an absence.      |
| Another seedling | `parent_seedling_id`, a seedling the caller can see, and never the seedling itself.   |
| Named cultivar   | `parent_cultivar_id`, a shared `cultivar_references` row, matched by normalised name. |

**Parent selection.** The parent selector is a short search, not a list of every seedling. A grower types a number, identifier, or the start of a working name. Results come from the database under RLS, so the grower gets their own visible seedlings and other growers' public ones, and never a private seedling of someone else. Each result shows the grower who holds it.

Parentage is set through `public.set_seedling_parent`, which replaces one role atomically. Pollen parent is optional. Nothing is inferred.

**Cultivar references.** Any participating grower may create one when parentage needs it. Names are normalised, and duplicates by normalised name are prevented. References are publicly readable. The table is not a cultivar catalogue.

### Provenance

Each new seedling gets one `originated` provenance event, in the same transaction as its identity. The table is append-only: updates and deletes are refused for every role, and ordinary clients have no write grant. Holder changes will add events in Phase 6, through the same transaction flag.

### Domain functions

| Function                                                                                 | Purpose                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `create_seedling(series_id, working_name, first_grown_year, visibility)`                 | Creates the seedling, its automatic number, any Series identifier, and its provenance, atomically. Originator and holder are the caller. |
| `create_series(name, include_year)`                                                      | Creates a Series, with its counter for yearless patterns.                                                                                |
| `attach_series_identifier(seedling_id, series_id)`                                       | Adds a Series identifier to a seedling the caller holds.                                                                                 |
| `set_seedling_parent(seedling_id, role, kind, parent_seedling_id, cultivar_name, notes)` | Sets one parent role on a seedling the caller holds.                                                                                     |
| `resolve_own_identifier(identifier)`                                                     | Resolves a human identifier within the caller's own namespace, including retired aliases.                                                |
| `next_series_identifier(series_id, first_grown_year)`                                    | Internal allocator, used by the two functions above. Clients have no execute grant.                                                      |

Clients update only `working_name`, `first_grown_year` and `visibility`, and only on a seedling they hold while not suspended.

### Routes

- `/series`: create and list your Series. Gated.
- `/seedlings/new`: create a seedling. Gated.
- `/seedlings/<uuid>`: the seedling. Public for visitors when public. The holder also sees the management forms. The originator who is not the holder sees a read-only record with a note.
- `/profile`: your seedlings, with links.

Seedlings are addressed by uuid. Human identifiers are not used in URLs, because the specifications do not define a public slug, and a uuid reveals nothing.

## Quality checks

| Command                | What it checks                               | Needs local Supabase? |
| ---------------------- | -------------------------------------------- | --------------------- |
| `npm run lint`         | ESLint (Next.js and TypeScript rules)        | No                    |
| `npm run typecheck`    | Strict TypeScript                            | No                    |
| `npm run format:check` | Prettier                                     | No                    |
| `npm test`             | Unit tests and repository guards             | No                    |
| `npm run check`        | Lint, typecheck, format and unit tests       | No                    |
| `npm run build`        | Production build                             | No                    |
| `npm run test:db`      | Behavioural RLS and storage tests            | **Yes**               |
| `npm run test:e2e`     | Browser journeys (builds and starts the app) | **Yes**               |

Run the database tests after `npm run supabase:start` and `npm run db:reset`:

```bash
npm run test:db
```

The database tests create real auth users with the public sign-up API. They read the local keys from `supabase status`, so nothing is written to disk. They use a superuser connection to grant admin and to check state, so **never point them at a hosted project**.

Run the browser tests the same way:

```bash
npm run test:e2e
```

They run on a phone-sized project (390 × 844, touch) and a desktop project. Each run builds the app.

CI (`.github/workflows/ci.yml`) runs the quality checks, the database tests and the browser tests on every pull request. The browser and database jobs start a local Supabase stack.

## Health / status

```
GET /api/health
```

- `200` with `{ "status": "ok", ... }` when configuration is present and well-formed.
- `503` with `{ "status": "error", "problems": { "missing": [...], "invalid": [...] } }` otherwise.

It makes no network calls, so a Supabase outage does not make the app look dead.

## Phase 2 verification

Run the database and browser tests after `npm run supabase:start` and `npm run db:reset`:

```bash
npm test                 # unit tests, including seedling validation and presentation
npm run test:db          # RLS, identifier, access and concurrency tests (vitest.db.config.mts)
npm run test:e2e         # browser journeys, phone and desktop
```

The concurrency tests (`tests/db/seedlings.concurrency.test.ts`) send parallel requests through the API: 20 creations for one Series and year, two years in parallel, a yearless Series, mixed automatic numbers, and parallel attachments.

## Manual verification

1. Run `npm run supabase:start`, then `npm run db:reset`.
2. Run `npm run dev` and open http://localhost:3000 on a phone-sized browser window.
3. As a visitor: open Home, then tap Capture. You should land on sign-in with the destination preserved.
4. Create an account, then set up your display name and country. You should arrive at Capture.
5. Open Profile, then Edit profile. Change the bio and save.
6. Open View public profile, then open that URL in a private window. The bio is visible there, with no edit controls.
7. Sign out from Profile. Tap Profile again: you should be asked to sign in.
8. Try a wrong password. The message is generic and announced to screen readers.

## Deployment

The app is designed for **Vercel + Supabase**. This repository contains no credentials.

### Vercel

1. Import the repository. Next.js is detected automatically.
2. The Node version comes from `.nvmrc`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **separately per environment**. Preview uses a non-production Supabase project with synthetic data. Production uses the production project only.
4. Do not expose `SUPABASE_SECRET_KEY` to the browser or to Preview unless a server route needs it.

### Supabase

Create separate projects for development, preview and production. Apply the same migration files everywhere. Automated migration push to hosted projects is not configured yet.

## Architecture

DahliaSeedling is a **modular monolith**: one Next.js application, one PostgreSQL database, and separated internal modules.

| Area            | Location                     | Rule                                                                                           |
| --------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Routes          | `src/app/`                   | Thin. They call the gate and the data layer, then render.                                      |
| Feature UI      | `src/components/`            | Presentation and client forms. No database access.                                             |
| Design system   | `src/design-system/`         | Raw HEX values live only in `tokens.css`. Components use semantic tokens.                      |
| Identity module | `src/modules/identity/`      | Validation, profile data access, the session layer, the participation gate and server actions. |
| Infrastructure  | `src/lib/`                   | Configuration, Supabase clients (`server-only`), safe redirects, health.                       |
| Database        | `supabase/`                  | Migrations, config, seed.                                                                      |
| Tests           | `src/**/*.test.ts`, `tests/` | Unit tests beside code. Database and browser tests in `tests/db` and `tests/e2e`.              |

**Rule for later phases:** domain operations live in `src/modules/<domain>/` as server-side functions called from server actions or route handlers. They do not live inside React components. The database enforces the rules. The UI does not. Phase 2 adds the Seedling module.

## Design system

- **Palette:** Aubergine `#382733`, Apricot `#F29B72`, Muted Plum `#8B6177`, Porcelain `#FBF7F1`, Sand `#E8DDD2`, Charcoal `#29272A`. All defined in `src/design-system/tokens.css`.
- **Primary actions** use Apricot fill with **dark Aubergine text** (`text-on-primary`). Apricot is never used for text on Porcelain, and white text is never used on Apricot.
- **Typography:** DM Sans for interface text, and Fraunces for the wordmark and display headings.
- **Touch and focus:** controls are at least 44 px. Visible focus is required for all focusable elements.
- **Navigation:** Home · Capture · Notifications · Profile, with an inbox icon. Capture is raised and in Apricot. There is no Explore destination.
- **Out of scope:** dark mode, a permanent logo, and the Cull symbol.

## Source documents

- Domain Architecture Specification v1.0 (locked baseline)
- Product Requirements Document (DOCX and PDF)
- Technical Requirements Document v1.0
- App Flow & UX Specification v1.0
- Data Model + Permissions Specification v1.0
- MVP Implementation Plan v1.0
- Design System & UI Brief v1.0
- Post-MVP Backlog (`DahliaSeedling_Backlog.md`)
