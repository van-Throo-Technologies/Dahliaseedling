# DahliaSeedling

A community and continuation platform for genetically unique dahlias grown from seed.

> **Phase status**
>
> Implemented: **Phase 0 — Foundation**, **Phase 1 — Identity & App Shell**, **Phase 2 — Seedling Core**, **Phase 3 — Capture & Observations** and **Phase 4 — Public Community Core**.
>
> Phase 5 has **not** been started.

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

Phase 3 adds `20261101010325_capture_observations`: the `media`, `observations` and `observation_media` tables, their RLS, grants and triggers, the private `private-media` storage bucket and its policies, and the functions listed under "Capture and observations".

Phases 1 and 2 create **no** Capture, Observation, media, Update, comment, follow, message or notification tables.

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

## Capture and observations (Phase 3)

**Capture** is the fast path: media goes straight to private storage and is saved. No form has to be completed first. An **Observation** is one dated moment, made of up to six photos or short videos, with an optional note. Observations are the record. Seedlings are the things they are about.

### Capture journey

1. The Capture screen opens with **Take photo** dominant, then **Record video** and **Choose a file**. The default seedling choice is **New seedling**.
2. The grower selects media. Each file is checked in the browser first, for a clear message.
3. **Save privately** uploads the files straight to private storage, then creates the Observation in one database call. The result opens with the confirmation "Saved privately. Added to Seedling #n. Nothing is shared."

A **New seedling** capture creates the seedling with its automatic number only. It never invents a Series identifier. The grower can add one later from the seedling page.

An **existing seedling** is chosen from the seedlings the grower holds, or by a known identifier (for example `JV-26-001` or `#4`). A manual attachment only ever resolves within the grower's own namespace. An unknown identifier gets the same message whether or not it exists, so the screen cannot be used to probe for other growers' seedlings.

### Observation model

| Field                         | Rule                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `observed_at`                 | When the thing was seen. Defaults to the time of capture, can be adjusted, and may not be more than 5 minutes ahead of the server clock. Upload time and record time are kept separately. |
| `visibility`                  | Always `private` in Phase 3. The column accepts no other value until Phase 4.                                                                                                             |
| `note` and `voice_transcript` | Up to 2000 characters each. Only the author can change the note.                                                                                                                          |
| `seedling_id`                 | The seedling the Observation is about. It can be changed later without re-uploading any media (see Correction).                                                                           |
| `deleted_at`                  | Soft delete. The Observation and its media are hidden, and the rows remain for audit.                                                                                                     |

**Privacy is separate from the seedling's.** An Observation about a **public** seedling is still private. Only its author can see it. Making a seedling public does not expose its Observations, and making an Observation public is not possible in Phase 3.

### Media

Originals are stored in the private `private-media` bucket, under a folder named after the uploader's user id. The bucket is not public, and no permanent or public URL is ever produced.

| Limit                 | Value                                                               |
| --------------------- | ------------------------------------------------------------------- |
| Files per Observation | 1 to 6, all distinct                                                |
| Image size            | 15 MB                                                               |
| Video size            | 50 MB                                                               |
| Video length          | 60 seconds. Checked in the browser only. See the limitations below. |
| Note length           | 2000 characters                                                     |
| Observed time skew    | At most 5 minutes ahead of the server clock                         |

Supported types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif` (images); `video/mp4`, `video/quicktime`, `video/webm` (videos). Anything else is refused by the bucket and by the database.

The limits are defined in `src/modules/capture/limits.ts`. The database enforces the same size and type limits in `_register_media_object` and in the bucket configuration, so a bypassed form still cannot store an oversize or unknown file.

**Delivery.** Media is never linked by storage path. `GET /media/<id>` checks the media row with the caller's own session. Only the owner receives a redirect to a signed URL that lasts 60 seconds. Every other request gets a 404, and the response is marked `Cache-Control: private, no-store`.

### Upload and retry

- The browser asks the server for upload paths first. The server issues the names, so a client cannot choose where a file lands.
- Uploads go directly from the browser to private storage. If one fails, the page keeps every selected file and says so: "Your photos are still here, so try again."
- The database capture call is idempotent. It is keyed by the first storage path, so a retry after a timeout returns the Observation already created, with no duplicate.
- Capture is atomic. If registering any file fails, the Observation and the media rows created so far are rolled back. No orphaned seedling or media row is left behind.

### Correction and move

- **Note:** the author can edit the note and the observed time.
- **Change seedling:** `move_observation` changes which seedling an Observation belongs to. The media rows keep their ids and storage paths, so **nothing is re-uploaded**. The move is only allowed for the author, and only to a seedling the author holds.
- **Delete:** `delete_observation` is a soft delete of the Observation and its media. Hard deletion is refused by triggers.

### Notes and voice

- The note is typed, and always available.
- **Dictation** uses the browser's speech recognition where it exists. Where it does not, the screen says "Dictation is not available in this browser. Type your note instead." Nothing else depends on it, so a failed or missing voice service never blocks a save.
- A dictated phrase of "new seedling" selects **New seedling**. Voice is plumbing only: it does not run any recognition or AI of its own.

### Share

**Share** is shown but disabled, with the label "Share (coming with Updates)". Sharing is a Phase 4 concern. Nothing in Phase 3 creates a public Update, and no Observation can be made public.

### Access and privacy

- Observations and their media are visible to their author only (RLS). Other growers, visitors and the seedling's holder get a 404 for an Observation they did not author.
- A suspended grower can sign in and view their own Observations, but cannot capture, change, move, or delete anything. This is enforced by the database policies, not only by the interface.
- The seedling page shows "Your private observations" to the author only.
- **Capture authority belongs to the current holder.** Only the current holder of a Seedling can add Observations to it, or move one onto it. Public visibility does not grant this. Neither does originator read access, knowing the uuid, or knowing an identifier. A former originator who is no longer holder keeps read access to the Seedling, but cannot add, move or edit Observations on it. Another grower cannot capture onto a public Seedling they do not hold, and a suspended holder cannot capture at all. These rules are tested in `tests/db/observations.rls.test.ts`.
- **Deletion respects the media boundary.** A soft-deleted Observation's media is no longer served. `/media/<id>` returns 404 to its owner, and storage refuses the owner a read or a removal of the object, as well as refusing visitors and other growers. The object stays in private storage. Nothing is purged in Phase 3. The rules in `_media_object_unregistered` treat a soft-deleted original as registered, so RLS on `media` cannot make it look unregistered.

### Known limitations

- **Metadata is not stripped in Phase 3.** Private originals are stored as uploaded, so any EXIF data, including GPS coordinates, is kept. Access is limited to the author, but the originals are not sanitised. No image-processing dependency was added for this. **Metadata stripping or sanitisation is required before any public derivative is introduced in Phase 4.** Public derivatives must not expose unnecessary metadata, especially precise location.
- **HEIC and HEIF previews depend on the browser.** Those files may be uploaded wherever they are allowed, even if the browser cannot render them. The page then shows "Preview not available in this browser. The file is still saved." No HEIC conversion service is used in Phase 3.
- **The 60-second video limit is a client-side UX constraint, not a server-enforced security invariant.** The browser checks the duration. A modified client could upload a longer video, as long as it stays within the server and storage size and MIME limits (50 MB, and the allowed types). No FFmpeg or transcoding is used in Phase 3. Server-side media inspection may be added later if real use justifies it.
- **Soft-deleted media is retained, not purged.** Deleting an Observation hides it and its media from every application path, and the object stays in private storage. No purge job exists in Phase 3. Physical storage reclamation and retention cleanup belong to later lifecycle and launch hardening.
- **Share is not available.** It is shown as disabled, and it creates no Update and no public media. Phase 4 adds deliberate publication.

## Public community (Phase 4)

Phase 4 turns the private record into public communication, deliberately. **Observation is documentation. Update is communication.** Recording something never publishes it.

### Observation and Update

- An **Observation** stays private to its author, whatever the seedling's visibility.
- An **Update** is a public post about one seedling. It is created from one observation, and it carries only the public copies of the images the grower chose.
- Publishing shares the chosen images as public copies. It never flips the observation or its private originals to public. The note, transcript and structured data stay private unless the grower writes new public text as the caption. The caption starts blank.

### The share journey

1. Open an observation and tap **Share selected photos**.
2. **Private seedling.** A public Update needs a public seedling page, so the first step explains that the seedling is private. Opening the step changes nothing. Pressing **Make Seedling public & continue** is the deliberate confirmation. It changes only the seedling's visibility. Cancelling before that press leaves it private. Once it is public, it stays public, even if the Update is then cancelled.
3. **Choose the photos.** Nothing is selected by default. Each image is ticked separately. Videos are listed, but cannot be chosen.
4. **Caption** (optional, blank by default), then **Publish update**.

Only the current holder can share, and only from an observation they wrote. A former originator, another grower, a visitor and a suspended grower cannot.

### Public images

- Public images are **sanitised derivatives**, separate from the private original. The original is never exposed, and its storage policies do not change when an image is published.
- Derivatives live in the `public-media` bucket. That bucket is **private**, like `private-media`. Readers get a signed URL that lasts an hour, and only while a live public Update references the image. The object is never readable by its path alone. See "Public delivery and revocation" below for exactly when access stops.

### Public delivery and revocation

**Interpretation.** The Data Model describes `public-media` as publicly readable. For MVP, "publicly readable" means that eligible public derivatives reach visitors through the application's public delivery mechanism. The bucket is not anonymously readable, so a suspended grower's or a deleted Update's image cannot be reached by guessing or copying a storage path.

**Boundary, in order:**

1. While an Update is eligible, a visitor is issued a signed URL for its derivative. The URL's token carries a lifetime of exactly 3600 seconds.
2. The Update is deleted, or its author or holder is suspended.
3. From that moment no new signed URL for the derivative can be issued. The database refuses it, because the link's eligibility check no longer passes.
4. A URL issued before step 2 remains usable until its own expiry. This is the accepted residual window for MVP: at most one hour. Instant revocation of issued links would need CDN or object-level invalidation, which is not built.
5. After expiry the URL is unusable.

The tests in `tests/db/signed-urls.test.ts` check steps 1 to 3 directly, and they confirm the one-hour lifetime from the token. They also show that a link issued before removal is still served (step 4), and that a one-second link stops working after it expires (step 5). The suite does not wait an hour.

- Format: WebP, quality 80, long edge at most 1600 px, aspect ratio kept, never enlarged, orientation applied to the pixels.
- **Metadata is removed.** Every derivative is written without EXIF, XMP or colour profile data, so GPS and camera details do not survive. The test in `src/modules/publications/derivatives.test.ts` proves this with a synthetic location marker, and the browser test checks the bytes a visitor receives.
- Processing uses `sharp` (approved), in the Node.js runtime, inside the publish server action. Nothing runs on the Edge runtime, and no separate service is used.
- Processing is **synchronous** during Publish. This is an intentional MVP simplification of the TRD's asynchronous wording.

### Failure model and double submission

- Derivatives are created and uploaded first. Then `publish_update` writes the Update, its public references and its derivative rows in one database transaction.
- Only a successful transaction reports **Published**. A failure at any step removes the derivatives uploaded so far, and nothing is referenced.
- The browser sends a client key with each publication. A repeated submission with the same key is refused by a unique constraint and returns the Update already made. The buttons also disable while a publication is in progress.
- A leftover upload is unregistered and is readable only by its uploader, so it can never appear publicly.

### Video: a known deferred MVP capability

**Public video publication is a known deferred MVP capability.** Short-video Updates remain an MVP requirement. Phase 4 does not provide them yet. The safe public delivery of video depends on a media-processing decision that comes after the core publication architecture is in place. Until then:

- Private video Capture works as before, and private video stays private.
- Video cannot be published through the interface, or by calling `publish_update` directly. The database refuses it with `public video sharing is not available yet`.
- No public video object is ever created.

This is not a Post-MVP item, and Phase 4 does not claim public video.

### Feed, journey and cover

- **Home is the public Feed.** Visitors can read it without an account. Signed-in growers can switch to **Following**, which shows Updates from seedlings and growers they follow.
- **Order:** newest publication first, with the Update id as a tie-breaker. No ranking, no popularity and no recommendation.
- **Pagination:** cursor based. The cursor is the publication time and the Update id, so equal timestamps still give a stable order, and a new Update never moves or repeats a page. Page size is 12.
- The Feed shows the grower's caption and photo, plus lightweight actions. It shows no identifiers, parentage, traits or structured data. Tapping a photo opens the persistent Seedling page.
- **Seedling journey.** The public Seedling page shows its cover, Follow and Save, and its Updates grouped by the year each observation was made. One seedling is one page, across years.
- **Cover.** The most recently shared public image is the default. The holder may choose another public image of that seedling. Video is never the cover. If the chosen image's Update is removed, the default applies again.

### Comments, likes, follows and Save

- **Comments and replies** live on each Update. A reply must belong to the same Update as its parent, enforced by a database trigger. Authors can edit and remove their own comments. A removed comment keeps its place, so its replies remain. Comments by suspended growers are hidden. Comments do not create any interest, reservation or transfer.
- **Likes** are one per person per Update. Liking and unliking are idempotent. A like changes only the count: it sends no notification and does not change the Feed order.
- **Follow Seedling** attaches to the Seedling's uuid, so it survives a change of holder. It is independent of Save.
- **Follow Grower** follows a profile. It is independent of following any seedling.
- **Save Seedling** is a private bookmark. Only the saver can see it. No save count is published. Phase 4 has no Saved list or navigation destination. The saved state appears on the seedling page, and a list can be added later with Search and discovery.
- All of these are idempotent. Repeating an action leaves one row, and a visitor or suspended grower cannot change any of them.

### Profile tabs

Each public profile has three tabs:

- **Seedlings:** public seedlings the grower currently holds.
- **Originated:** public seedlings the grower originated, including those someone else holds now.
- **Updates:** the grower's live public Updates.

A visitor sees only what the database allows them to read. Private seedlings and deleted Updates are never listed.

### Permissions and suspension

| Action                                                      | Who may do it                                                   |
| ----------------------------------------------------------- | --------------------------------------------------------------- |
| Read the Feed, a public Update, a journey, comments         | Anyone, including visitors                                      |
| Publish an Update, choose the cover, make a seedling public | The current holder, from an observation they wrote              |
| Delete an Update                                            | Its author                                                      |
| Comment, reply, edit or remove own comment                  | Participating growers                                           |
| Like                                                        | Participating growers                                           |
| Follow Seedling, Follow Grower, Save                        | Participating growers (Follow Seedling needs a public seedling) |

A suspended grower cannot publish, comment, like, follow, save or change anything. Their public content is hidden from the Feed, journeys and profiles, and it is not destroyed. The rule is applied in the database, so a suspended holder's Seedling and its Updates disappear from every public read.

### Removal and retention

- Deleting an Update removes it from the Feed, the journey and the profile. The derivatives it alone referenced are retired. Their objects remain in private storage, unreadable, and no purge job runs in Phase 4.
- The source observation, its note, transcript, structured data and the private originals are never changed by publication or removal.

### Phase 4 verification

```bash
npm test                 # unit tests, including derivative metadata, orientation and size
npm run test:db          # publication privacy, Storage, cover, Feed, comments, likes, follows, Save
npm run test:e2e         # sharing, Feed, journey, comments and likes, phone and desktop
```

Derivative processing uses synthetic metadata only. No real location data is kept in the repository.

### Manual verification

1. Create an account, capture a photo, and open the observation.
2. Tap **Share selected photos**. Confirm the seedling is still private, and that the page says so.
3. Tap **Make Seedling public & continue**. Choose one photo, add a caption, and publish.
4. Open the Feed in a private window. The Update appears with the derivative, and the observation is not reachable.
5. Open the seedling from the photo. The journey shows the Update, and the cover is that photo.
6. Comment, reply, edit and remove your own comment, and like the Update. Signed out, the same actions take you to sign-in.
7. Follow the seedling and the grower. Save the seedling, and check that only you see it saved.
8. Open the profile and check the three tabs.
9. Confirm the private observation still says it is private, and that its other photos are still not shared.

### Known limitations

- Public video is deferred (see above).
- Derivatives are generated synchronously, so a large batch of photos takes longer to publish.
- Signed URLs last an hour. A copied link keeps working for up to an hour after removal or suspension.
- Retired derivative objects remain in private storage until a later lifecycle phase.
- **HEIC private capture works, but HEIC public publication does not.** HEIC and HEIF photos are accepted, stored privately, and shown in the timeline. The bundled `sharp` (libvips 8.18, libheif 1.23) reads the AV1-based HEIF container, but not the HEVC encoding that phone cameras use for HEIC. A real HEIC sample fails to decode with "HEVC (a suitable decoder plugin is libde265) not built in". So the Share step shows such photos as "stays private", cannot tick them, and the server refuses them before anything is downloaded. Adding a decoder or a conversion service is a separate decision, and none was added here.

## Languages (Phase 4.5)

The interface is available in English, Nederlands and Français. English is the fallback for every other language.

### How the language is chosen

In order, highest first:

1. The visitor's or grower's explicit choice, stored in the `dahlia_locale` cookie (one year) by the language selector.
2. The browser's `Accept-Language` preference. Quality weights are honoured, and a regional tag counts as its language (`nl-BE` is Dutch).
3. English.

Nothing else influences the language: not the profile country, the IP address, or a Seedling's country. The language is never an authorisation input.

### Stable addresses

Addresses never carry a language. Changing the language keeps the visitor on the same page, and every UUID in a route stays as it is.

### Three kinds of content

| Category                | Examples                                                                                                                                                                | Handling                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Application language    | buttons, labels, validation and error messages, page copy                                                                                                               | Translated in `src/i18n/messages/`                            |
| Canonical domain values | visibility (`private`, `public`), parent roles (`seed_parent`), country codes (`NL`)                                                                                    | Stored language-neutral; shown through the glossary or `Intl` |
| User and domain content | cultivar names (`Wizard of Oz`), Seedling identifiers (`#14`, `JV-26-014`), Series codes, working names, captions, notes, transcripts, comments, profile names and bios | Never translated                                              |

Seedling identifiers and cultivar names are shown exactly as they were entered. The interface words around them are translated.

### Dictionaries

- One file per area in `src/i18n/messages/`, each with `en`, `nl` and `fr`. Dutch and French are typed against English, so a missing key is a type error.
- `src/i18n/messages/parity.test.ts` checks that every language has the same keys and the same placeholders.
- Values are inserted as plain text, never as markup.
- Server code uses `getTranslation()`. Client components use `useT()` and `useLocale()`, and receive only the active dictionary.
- Validators and domain code return keys (`Msg`), so the sentence is chosen where it is shown. Database error text is mapped to keys in `src/i18n/database-messages.ts`. Unknown database text falls back to a generic message and is never shown raw.

### Adding a string or a canonical value

1. Add the key to the English dictionary, then to `nl` and `fr`. Typecheck fails until all three exist.
2. For a new canonical value, store the language-neutral code and add its glossary entry in all three languages.
3. Run `npx vitest run src/i18n` and then `npm run check`.

### Formatting

Dates, numbers and country names use `Intl` for the active language (`src/i18n/format.ts`). Dates are formatted in UTC. Stored values never change.

### Deliberately English

Developer-facing output stays in English: configuration errors (`src/lib/config/env.ts`), `/api/health`, and server logs.

### Rules for later phases

Every new user-visible string is added to English, Dutch and French in the same change. The app uses no translation service, no runtime machine translation, and no translation tables in the database.

### Verification

- Unit tests: dictionary parity, the translator, locale resolution and fallback, and locale-aware presentation.
- Browser tests: `tests/e2e/language.spec.ts` covers the saved choice, the unchanged address, the browser language and the English fallback.
- Layout: checked at 390×844 and 1280×800 in English, Dutch and French. On narrow screens the header wraps so the longer translated labels fit.

## Search & Discovery (Phase 5)

Home contains the public Feed and one Search box. There is no separate Explore destination, and no marketplace navigation. Visitors can search without an account. With no query and no country, Home shows the Feed as before.

### What is searched

- **Seedlings:** the automatic number and any Series identifier (current or retired) resolve to the Seedling. The working name is matched. A Seedling whose recorded seed or pollen parent is a matching cultivar, or a matching public Seedling, is also returned as a related match, one hop only.
- **Cultivar References:** the cultivar name. Each result shows the number of public Seedlings that record it as seed parent and as pollen parent, and links to a search for that name.
- **Growers:** the display name, and the account presentation label as its canonical value (`breeder`, `farm`, `individual`). Only this English token is matched; localised label text is not parsed.
- **Not yet:** Seed and Seedhead Offers (Phase 7).

### Privacy boundary

Every search function is `SECURITY INVOKER`, so row-level security decides which rows a reader may see. The functions repeat the public rules as explicit predicates as a second layer. Private Seedlings, private parents and suspended growers never appear. A zero-result search reveals nothing about private matches. Search reads no Observations, media, notes, transcripts, Saves or account data. Images come only from public derivatives, through the existing cover path.

### Identifiers

Automatic numbers belong to one grower, and a Series belongs to one grower, so the same identifier can legitimately match several Seedlings. Search returns every legitimate match with its grower, country and identifier context. It never picks one arbitrary Seedling. A retired identifier resolves to its canonical Seedling once. The current model has no workflow that retires an identifier, so that case is tested with a directly inserted row.

### Normalisation

Text is trimmed, internal whitespace is collapsed, and comparison ignores case. An identifier also drops one leading `#` and ignores case. Punctuation is kept, so `JV-26-014` and `JV-26-41` stay different. Accents are not folded. Stored values are never changed. The TypeScript and SQL normalisers mirror each other.

### Ranking

Deterministic, in this order:

1. identifier exact match;
2. working name exact match;
3. identifier or working name prefix (identifiers need at least two characters);
4. working name contains the query;
5. related match: a recorded cultivar parent matches, or a recorded parent Seedling matched directly;
6. country only, when no query is given.

Within a tier, results sort by display text, then by id. Likes, follows, Saves, comments and recency never affect ranking. A Seedling appears once, with its strongest reason.

### Filters

- **Country** uses the current holder's canonical ISO code. The list shows names in the reader's language, and the stored code is what is compared. A query and a country combine with AND. Cultivar References have no country, so with a country filter the cultivar group is not shown.
- **Deferred:** Cull available (Phase 6, when continuation state exists), Seeds and seedheads (Phase 7, when offer state exists), colour and form. The schema has no authoritative public colour or form field, so no taxonomy was invented.

### Bounds and pagination

Each group returns 12 results per page. The database returns one extra row, so the page knows whether a further page exists without a separate count. Continuation is cursor-based and per group: Seedlings, Cultivars and Growers each keep their own position, so continuing one never moves another.

A cursor is the position of the last row shown, in the total order (match tier, sort text, id). The next page resumes exactly after that row, so no result repeats or is skipped while the data does not change. The cursor holds only the normalised query, the country code and the ordering values, all of them public, and it is bound to the query and country it was issued for. A cursor from another search, or a malformed one, is refused: the first results are shown, with a notice.

Continuation does not change the Search privacy boundary. Private Seedlings, private parents and suspended growers are absent from every page. The database does the continuation: the application receives at most one page of rows at a time. The database still evaluates the matching set for each page before it skips to the position, so a continuation costs about the same as a first page.

### Performance and indexes

No extension is enabled and no trigram or other search index exists. Substring Seedling search scans the public rows; that is the known characteristic. On a scratch development dataset of about 6,100 Seedlings, 446 profiles, 830 cultivars and 3,030 parentage rows, measured as the `anon` role (median of three runs):

- a first page of a name substring search (`sunset`) took about 59 ms;
- a continuation page of the same search took about 57 ms, and returned 13 rows;
- a country-only Seedling search took about 2 ms, for both the first and a continuation page;
- a cultivar search took about 4 ms, and a grower search about 9 ms (first page) and 15 ms (continuation).

A continuation is bounded to 13 rows returned, but the database still evaluates the matching set before it applies the cursor position, so a continuation costs about the same as a first page. These are measurements on development data, not production guarantees. Reconsider a trigram or other index only when realistic scale shows that the substring path is too slow.

### Multilingual behaviour

Only the words around results are translated. Queries are never translated, and identifiers, working names, cultivar names and grower names are shown exactly as stored. Switching language keeps the query and the address. Canonical values, such as the country code and the visibility, stay language-neutral in the database and in every filter; the locale changes only how they are shown.

### Not implemented

Typo tolerance (no trigram), Explore, popularity or behavioural ranking, recommendations, AI or semantic search, external search engines, and duplicate merging.

## Continuation and rehome (Phase 6)

A grower may decide not to keep growing a Seedling. That is not a judgement that it is not worth growing: another grower can continue it. The Seedling keeps its uuid, its working name, its identifiers, its originator and its history. Only its current holder changes, and only when the chosen recipient confirms receipt.

### Terminology

| Concept      | English                  | Dutch                        | French                            |
| ------------ | ------------------------ | ---------------------------- | --------------------------------- |
| The decision | Not keeping this one     | Ik kweek deze niet verder    | Je ne poursuis pas ce semis       |
| Availability | Looking for a new grower | Zoekt een nieuwe kweker      | Recherche un nouveau cultivateur  |
| Terms        | Donate / Sell / Trade    | Schenken / Verkopen / Ruilen | Donner / Vendre / Échanger        |
| Choosing     | Choose as new grower     | Kies als nieuwe kweker       | Choisir comme nouveau cultivateur |
| Confirming   | Confirm receipt          | Ontvangst bevestigen         | Confirmer la réception            |

"Cull" is an internal concept only and is never shown. It is never translated as "afgekeurd" or "rejeté".

### State

Canonical states live in `rehome_cases.status`: `available`, `arranged` (a recipient is chosen), `sent`, `completed` (receipt confirmed, holder changed), `cancelled`, and reopening returns `arranged` or `sent` to `available`. The labels are translated; the states are not.

- **One active continuation per Seedling.** A partial unique index allows at most one row in `available`, `arranged` or `sent` for each Seedling. Concurrent starts are rejected by the database.
- **Only the current holder starts a continuation.** The holder may withdraw availability, choose one recipient, mark the Seedling sent, or reopen it.
- **Interest does not transfer anything.** Expressing interest records a private row. It is withdrawable and does not change the holder.
- **One whole clump, one recipient.** The holder chooses exactly one interested grower.

### Holder, originator and recipient

- The **originator** is set when the Seedling is created and never changes.
- The **current holder** changes only through `confirm_rehome_received`. That function locks the case, requires the caller to be the chosen recipient, sets the transaction flag `dahlia.holder_transfer`, appends one `continuation_received` provenance event, and withdraws the remaining interests. It runs as one transaction.
- A second confirmation returns `already_completed` and changes nothing. A sender whose case no longer matches the current state gets `stale`, and the continuation closes without a transfer.
- After a transfer, the old holder loses holder authority and the new holder gains it. The originator keeps origin, not authority, unless they become holder again through a later completed continuation.

### Visibility and privacy

- A Seedling must be public before it can be offered. The start form asks for an explicit confirmation of this, and that step does not change the private observations or media. Its private observations, notes and photos stay author-only, and a new holder cannot read them.
- Visitors see only that the Seedling is available, its terms, and its note. They see no interests. A visitor is shown a sign-in link to express interest.
- Interests are private: the holder sees who is interested, each interested grower sees only their own interest, and nobody else sees them. Interests are separate from comments.
- `rehome_panel` returns nothing for a Seedling the caller cannot see. Suspended holders are hidden from public reads.

### Donate, Sell and Trade are information

Terms, prices and handover methods are free text and enumerations shown for information. DahliaSeedling processes no payment, arranges no shipping, issues no plant passport and collects no health declaration. Payment and handover happen between the two growers, outside the app. The form says so.

### Search availability filter

Search has an availability checkbox (`available=1`). It reads canonical continuation state, not the Feed: only an `available` case on a public Seedling matches. Pending, arranged, sent, completed, cancelled and withdrawn cases never match. The filter combines with a name or identifier query and with the country filter, which follows the current holder. The availability filter is bound to the pagination cursor, so a cursor from one filter cannot be replayed under another.

### Provenance link

A completed continuation's holder-transfer provenance event (`continuation_received`) references the exact Rehome case that caused it, through `provenance_events.rehome_case_id`. Only one transfer event can name a case, and a transfer event must name one. Origin events keep a null reference. The link is domain integrity, not a public field: anon and authenticated readers may not select it, and it does not change who can read a case.

### Visibility is not availability

Two decisions are separate, and the database keeps them separate:

- **Visibility** (`seedlings.visibility`) decides whether the Seedling is public. Starting availability on a private Seedling is a deliberate step that makes it public, and nothing else changes that.
- **Availability** (the continuation state) decides whether another grower may take it on.

Withdrawing availability, cancelling, or completing a continuation changes the continuation state only. None of them makes a Seedling private again. A change back to private is an ordinary Seedling privacy change, made by the holder through the usual Seedling settings.

### Active interests and the holder's list

The holder's selection list shows active interests only. A withdrawn interest is kept in `rehome_interests` for integrity but is not offered as a choice, and `choose_rehome_recipient` refuses any grower without an active interest. The list therefore stays bounded by the growers who are actionable now, not by everyone who ever withdrew.

### Recipient decline

Source documents do not define recipient decline. The MVP rule used here is:

- Only the selected recipient may decline, and only while the case is `arranged` (not `sent`, never after receipt).
- The case returns to `available`, the selected recipient is cleared, and the holder is unchanged. No provenance event is written.
- The decliner's own interest is withdrawn but kept, so the history of interest stays intact. They may express interest again.
- A repeat decline, a suspended recipient, a non-recipient, and a completed or sent case are all refused.

Recovery from a failed arrangement after it is `sent` remains the holder's action (reopen or withdraw). No shipping dispute workflow exists.

### Notifications and messaging

Deferred to Phase 8. Phase 6 sends no notifications and provides no messaging between growers. Moderation is not expanded.

### Verification

- `tests/db/rehome.test.ts` covers authority, terms, the absence of health fields, interest privacy, the choice and confirmation boundary, double confirmation, a competing choice, a stale sender, authority after transfer, private observations after transfer, identifiers persisting, an A to B to C chain, returning to the originator, withdrawal, cancellation, reopening, and suspension.
- `tests/db/rehome.search.test.ts` covers the availability filter, the country after a transfer, pagination with the filter, and identifier and name search after a transfer.
- `tests/db/rehome.decision.test.ts` covers the active-interest holder list, withdrawn records kept, and recipient decline.
- `tests/db/rehome.closure.test.ts` covers historical private Observation and media privacy after a real transfer, old and new holder authority, races on separate connections, pending-recipient privacy, suspension, and the A → B → C → A chain.
- `tests/db/rehome.provenance.test.ts` covers the provenance link to the originating case, double confirmation, non-completed cases, the integrity constraints, and the privacy of the link.
- `tests/e2e/rehome-closure.spec.ts` follows a Seedling through Search across a real transfer, and checks the Dutch and French states during a live continuation.
- `tests/e2e/rehome-keyboard.spec.ts` operates the Phase 6 controls from the keyboard, with a visible focus ring and touch targets of at least 44 px.
- `tests/e2e/rehome.spec.ts` runs the principal journey on phone and desktop: a holder makes a private Seedling available, a visitor sees availability and the sign-in gate, a second grower expresses interest, the holder chooses, the recipient confirms, and the same Seedling keeps its address and history.
- Security mutation: breaking the recipient check in `confirm_rehome_received` fails the boundary test; the restored migration passes.

### Known limitations

- Pickup and shipping details are free text and are not validated.
- Notifications and messaging are not provided; growers learn about a chosen recipient only from the Seedling page.
- The Search availability filter is covered by database tests and by a browser journey that follows the Seedling through Search.

## Seeds and seedheads (Phase 7)

Seeds and seedheads are offspring material. They offer genetic potential, not the same plant. They never receive a Seedling identity, and a Seedling is created only for a plant that is actually recorded after germination. Sharing seed material never transfers a Seedling, its holder, its originator or its UUID.

Migration: `supabase/migrations/20261104090000_seeds_and_seedheads.sql`. The Phase 2 parentage constraint is replaced by a four-way exactly-one constraint. Existing rows keep their meaning, and the Phase 2 function is untouched.

### Four source states

A seed source has exactly one maternal reference, enforced by `seed_source_exactly_one_reference`. Parentage has the same rule through `parentage_exactly_one_reference`.

| State               | Stored as                                         | Meaning                                                       |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| Seedling            | `seed_sources.source_seedling_id`                 | The exact parent is a persistent Seedling.                    |
| Named cultivar      | `source_cultivar_id`                              | The exact parent is a known cultivar (`cultivar_references`). |
| Unidentified dahlia | `source_unidentified_id` → `unidentified_sources` | One exact physical plant is known; its name is not.           |
| Unknown or mixed    | `source_unknown_mixed = true`                     | The maternal plant cannot be identified.                      |

### Unidentified dahlia

- It is an internal record with its own identity. It is not a Cultivar Reference and not a Seedling. No cultivar or Seedling is created when it is recorded, and the tests check this.
- Its photographs are the uploader's private originals, linked through `unidentified_source_photos`, up to four. A source cannot be created without at least one, and a seedling cannot name one as parent without one.
- Its optional description is the grower's own words, shown as written and never translated. It is not a name and not an identity.
- Only the creator may add photographs or record it as a parent. Public readers see its description only through a live public offer.
- Resolution is possible later without touching offspring. `set_seedling_parent` can replace the parent row with a cultivar or a Seedling, and the Seedling UUID is unchanged. A test proves this. No resolution workflow is built.

### Offers

- `seed_offers` records material (`loose_seeds` or `seedheads`), quantity (packet size or seedhead count, never both), mode (`free`, `for_sale`, `trade`), an informational `price_text` for a sale only, handover (pickup, shipping or both), and an optional note.
- Closing is a state change (`is_active = false`, `closed_at` set). The source and its history stay. Closing is idempotent.
- There is no stock, reservation, payment, checkout, shipping label or tracking. The schema has no such columns, and a test checks this.

### Image rules

- **Named cultivar:** a photograph of the actual parent plant is required before publication. The photograph is recorded on the source (`set_cultivar_parent_photo`).
- **Unidentified dahlia:** a photograph of the actual source plant is required. The database refuses a publication without one.
- **Known Seedling parent:** the seed parent must be a public seedling the caller holds, with a public photograph already on its record. Private originals are never used.
- **Unknown or mixed:** no photograph is required, and none may be attached.
- Every image shown with an offer is a public derivative (WebP, EXIF and GPS stripped by the Phase 4 pipeline). The original is never linked from an offer. `_derivative_is_public` now also accepts a derivative shown by a live public offer. The original is still never public.

### Visibility, authority and interest

- An offer is public while it is active, its seller is not suspended, and a seedling source is itself public. Closing or suspension hides it at once. The source's owner id and the private parent photograph are never granted to anonymous readers.
- Only the seller creates, closes and manages an offer. A grower cannot create an offer in another's name, and a suspended grower can do none of these.
- Interest is structured, with an optional quantity. It is one active row per grower and offer, withdrawable, and never opens a conversation. The seller alone sees who is interested. The seller cannot express interest in their own offer.
- Interest is refused once the offer closes. The race is tested across two database connections: a late interest waits for the close and is then refused.

### Where offers appear

Offers from a Seedling appear on that Seedling's page. Other offers appear on the seller's profile. There is no Explore destination, no marketplace tab and no storefront. A visitor sees the same live offers and must sign in to express interest.

### Off-platform arrangements, no guarantees

Payment and shipping are arranged between the growers. DahliaSeedling does not certify the material, does not promise germination, and has no health declaration, phytosanitary, plant-passport or shipping-eligibility workflow. There is no mandatory germination test.

### Notifications and messaging

Deferred to Phase 8. Interest is the Phase 7 bridge. A `seed_offer_interests` row can later carry a conversation, and the source and offer are its context.

### Search and the parentage form

- **Search.** Live Seed and Seedhead Offers are found through the one Home Search, with a "Seeds or seedheads available" filter (`seeds=1`). The filter reads canonical offer state: only active offers of public seedlings and non-suspended sellers match. The offers appear as their own group, with their own cursor. Matching is on public text only: the cultivar name, the seedling's working name, the grower's own description of an unidentified dahlia (descriptive text, never identity), and the seller's display name. Country is the seller's country, which is discovery geography, not shipping eligibility. The Seedling availability filter and the seeds filter stay separate, and combining them returns nothing.
- **Parentage form.** The seed or pollen parent can be an unidentified dahlia. The holder reuses a source they own, or adds a new one with a photograph of the actual plant. The database requires the photograph and the holder's authority; a bypassed form cannot record one without it.

### Deliberately deferred

- Creating a Seedling from germinated material as an action. A grower records the Seedling with the existing Create Seedling flow and sets its parent.
- A resolution workflow for an unidentified dahlia. The schema permits re-recording the parent as a cultivar or a Seedling without changing the offspring UUID; a test proves it. No correction UI is built.

### Verification

- `tests/db/seeds.test.ts`: the four source states, the photograph rules, quantities and prices, closing, interest and its privacy, visibility and privacy of photographs, parentage, Phase 2 regression, offspring and holder invariance, suspension, resolution readiness and the close-versus-interest race.
- `src/modules/seeds/validation.test.ts`: input rules for each source state, quantities, prices, photographs and interest.
- `tests/e2e/seeds.spec.ts`: the unidentified path (refused without its photograph, then published), the visitor view, interest and the seller's view, the Dutch labels, and keyboard operation with touch targets.
- Security mutation: disabling the photograph requirement at source creation fails the database test for it. The migration was restored byte-for-byte.

## Messaging, notifications and moderation (Phase 8)

Messages and notifications are two separate systems. A **message** is private text in a conversation that only its two participants can read. A **notification** is an attention signal: a typed row that names what happened and links to it. A notification never carries message text, and a message never appears as a notification.

### Conversations and context

A conversation is one-to-one. Its two participants are stored in order, so a pair has one identity. It is always about a context: a direct message, a public Seedling, a continuation (Rehome case), or a seed offer. A conversation is unique for a pair and context, so repeated presses open the same thread.

- A Rehome conversation is between the holder and one interested grower. It exists from the moment of interest, so the Inbox lists it straight away. The database creates it in the same transaction as the interest.
- A seed-offer conversation is between the seller and one interested grower, created the same way.
- A direct or Seedling conversation is opened by a button, and only for a live public Seedling or a grower who is not suspended.

Context is typed and structural: each context reference is a real foreign key, and a check ties the type to exactly one of them.

### Messages

- Text up to 2000 characters, and at most one photograph (JPEG, PNG or WebP, 2.5 MB, the seed photograph limit so requests stay within the server action size limit).
- A photograph is stored in the sender's private folder. Its media row and storage object are readable only by the two participants, through an extra row-level policy. The private media route serves it through a short-lived signed URL. No public derivative is made.
- **Messages are immutable after sending.** No edit or delete path exists. See "Message edit and deletion" below.
- Sending is idempotent. Each send carries a client key, and a repeated submission returns the message already written.
- Read state is one marker per participant. A message is unread when the other participant wrote it after that marker. Sending advances the sender's own marker.

### Notifications

Each notification has a type, an actor, the references it needs, a read time and a stable dedupe key. The database creates them with triggers, in the same transaction as the event, so an interest or a selection never exists without its notification. The types are:

- `comment` and `reply` on an Update;
- `message`, bundled: one unread notification per conversation, however many messages arrive;
- `rehome_interest`, `rehome_selected`, `rehome_sent` and `rehome_received`;
- `seed_offer_interest`;
- `followed_seedling_update`, for followers of that exact Seedling;
- `availability_trigger`.

The Notifications page lists them newest first with read and unread state, and marking read changes only the reader's own rows. Each sentence is written in the reader's language, names the actor, and falls back to a neutral phrase when the actor cannot be read. A notification never states who reported anything: reports create no notifications at all.

### Notify me if available

A signed-in grower who is not the holder can subscribe to one public Seedling. When that Seedling's continuation becomes available again, each subscriber receives one notification and one availability email, once per case and subscriber. The email is delivered as described under "Availability email". Completing a continuation closes the alerts for that Seedling.

### Blocks

A block is one directional row, and it works in both directions for new private contact. While a block exists, neither grower can send a message, start a conversation, or express interest in the other's continuation or seed offer. Existing history stays readable on both sides. A block list is visible to its owner only.

Every path that reads or changes block state for a pair takes a per-pair advisory lock first: starting a conversation, sending, expressing interest, blocking and unblocking. A send that races a block is therefore either written before the block or refused after it.

**Blocking and reporting are separate actions.** Blocking does not report anyone, and reporting does not block anyone. A grower chooses each one independently.

### Reporting

A grower can report four targets, as the locked moderation baseline requires:

| Target          | Where the control is                                           | Eligibility                                                                       |
| --------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Public Update   | Under the Update, for signed-in readers who are not its author | The Update must be live and public; its author must not be suspended.             |
| Comment         | On each comment that is not removed and not the reader's own   | The comment must be live and its Update public; its author must not be suspended. |
| Profile         | On another grower's public profile                             | The profile must not be suspended.                                                |
| Private message | On a message from the other participant in a conversation      | The reporter must be a participant in that conversation.                          |

Rules enforced in the database, not by the page:

- Visitors cannot report. Suspended growers cannot report.
- A grower cannot report their own content or themselves. This is refused for every target.
- Targets are resolved from their identifiers and the database's visibility rules, so a browser cannot name a grower or a target it may not see.
- The report records the reported grower and a copy of the content at the moment of reporting: the Update's caption, the comment's text, or the message's text. A private message's photograph is referenced but not shown to the reviewer.
- While a report is open, the same reporter cannot create a second report for the same target. The first one is returned.
- Reporting never deletes or hides anything, and it never notifies the reported grower.

The reporter can read their own report. The reported grower cannot read it, and neither can an unrelated grower or a visitor. The reported grower's identity is not granted to clients at all, so a reporter also cannot read it directly from the table.

### Administrator review

The review surface is a single protected page, `/admin/reports`. It lists reports waiting for review by default, or all reports. Only an administrator sees it; anyone else gets the same not-found page as any missing resource. It is excluded from search indexing. It is not in the primary navigation, because access is granted by an administrator row and not by a profile setting.

For each report the page shows the target type, the reporter, the reported grower and whether they are suspended, the reason and details the reporter gave, the time, the saved content, and a link to the public page when that page still shows the content. Every action goes through a function that checks administrator status again:

- **Mark as reviewed, mark as actioned, dismiss.** `resolve_report` changes an open report once. A resolved report cannot change again, so each decision is recorded exactly once.
- **Remove from public view.** Offered for a public Update or comment. It is a soft delete, the same as the author's own delete, which clears a Seedling's cover image if the Update was the cover. Seedling identity and provenance are never touched. Removing content that is already removed records nothing new.
- **Suspend account, lift suspension.** Uses the Phase 1 authority, `admin_set_suspended`. It adds no flag and deletes nothing. A suspended grower cannot take part, and their public profile and content follow the existing visibility rules. An administrator cannot suspend their own account from a report.

Administrators do not browse conversations. The page never opens a conversation, and a private message's text is shown only as it was saved when it was reported.

Each administrator decision is recorded in `admin_actions`: the report resolution, the removal, and the suspension or restoration, with the administrator, the target and the reason where one was given.

### Message edit and deletion

**Not required for MVP. Sent messages are immutable.** The sources give edit and delete semantics only to comments and to the author's own ordinary Updates. The Data Permissions document says "User-facing deletion policy to be finalized" for messages, and it does not define an edit rule for them. Messages therefore have no edit, unsend, delete-for-me or delete-for-everyone path, no tombstones and no edit history. A grower who wants a message dealt with can report it, and a reviewer sees the text saved at the time of reporting.

The Data Permissions table for messages lists a `deleted_at` column. It is not in the schema, because adding a column with no policy behind it would be speculative. If a deletion policy is defined later, the column is added with it.

### Notification navigation badge

**Not required for MVP.** The PRD fixes the authenticated primary navigation as Home, Capture, Notifications and Profile, and says the inbox is reached by an icon. No source asks for an unread count. Notifications have a real page with read and unread state, and the Inbox shows which conversations are new. The navigation is unchanged, and the absence of a count is deliberate.

### Availability email

The Notify-me availability alert is the only event sent by email in the MVP. Comments, replies, likes, follows, private messages, continuation and seed interest, moderation and digests stay in the app. The provider is Resend.

**Flow.** An availability event writes the in-app notification and one `email_outbox` row per subscriber, in the same transaction as the event. Sending happens afterwards, in a separate request, so a Resend outage cannot roll back the availability itself.

**Delivery.** A scheduled request to `/api/email/deliver` runs the worker:

1. it claims due rows with `email_claim_due`, under a five-minute lease and a fresh claim token;
2. it reads the context for each row with `email_delivery_context`, which decides whether the alert is still valid and reads the recipient's address at send time;
3. it sends through the provider interface, or records a suppression;
4. it records the outcome with the claim token it holds. A worker whose lease has expired cannot record an outcome for a row someone else now owns.

**Outcomes.**

- `sent`: the provider's message id is stored. The address and body are not.
- Retry: a temporary failure (no response, rate limiting, or a server error) keeps the row pending, with a backoff of 1, 2, 4 … minutes capped at 60, for up to five attempts. The fifth failure marks it `failed` with `attempts_exhausted`.
- `failed`: a permanent client rejection from the provider, or a suppression.
- Suppressed, and never sent: the recipient is suspended or no longer exists, the subscription was closed by an unsubscribe or by completing the continuation, or the continuation is no longer available.

No outcome changes the in-app notification, the subscription or any account. The provider's own error text is never stored, logged or returned.

**Idempotency.** One logical email exists per availability event and subscriber, enforced by a unique key. A repeated event returns the same row. Each delivery attempt for one row sends the same provider idempotency key, `dahlia-availability:<outbox id>`, so a retry after a lost response is the same send at the provider, within the provider's idempotency window. Retries of delivery are allowed; a second logical email is never created.

**Concurrency.** Claims are made in one statement with `for update skip locked`, so two workers never receive the same row. The due-row lookup uses the partial index `email_outbox_due_idx`; at 20,000 rows, the claim took about 0.2 ms with a plan that used that index, so no further index was added.

**Provider boundary.** `src/modules/email/provider.ts` defines the interface that domain code depends on. `src/modules/email/resend-provider.ts` is the only module that imports the Resend SDK. Failures are classified as temporary (retryable) or rejected (final). The rest of the application does not depend on Resend.

**Language.** Profiles store no language, so the language is captured when a grower subscribes, from the locale they are reading. An unknown value falls back to English. The subject and body are in English, Dutch and French. Seedling names and identifiers are shown exactly as stored.

**Data sent to the provider.** Only what delivery needs, and nothing else:

- the recipient's email address;
- the subject and the body, in the recipient's language;
- the Seedling's working name, as the grower stored it, when the grower set one (otherwise a sentence without a name);
- the link to the Seedling page, which contains only the Seedling's identifier;
- the sender address, the provider message id and the idempotency key, which is derived from the outbox row's identifier.

Never sent: Observations, private messages, reports, source descriptions, interested-grower lists, private media paths, profile fields other than the address, and any health or compliance information. The email contains no recommendations, other Seedlings, promotions or social activity, and it does not reserve the Seedling or promise it.

**Managing the alert.** The email links to the Seedling page, where the grower can choose "Stop notifying me". There is no unsubscribe token or one-click link, because the alert is a transactional message the grower requested, not a mailing list. Stopping the alert takes effect for any row not yet sent, because delivery checks the subscription at send time.

**Tracking.** The product does not depend on open or click tracking. Disable open and click tracking for the sending domain in Resend.

**Access.** Clients cannot read, write or call the outbox or its functions. The worker reaches the outbox only through the five delivery functions listed under "Worker privileges" below.

### Deployment: availability email

Production email needs these server-only values in the hosting environment, never in the repository:

| Variable              | Purpose                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`      | Resend API key (secret).                                                                     |
| `EMAIL_FROM_ADDRESS`  | Sender, for example `DahliaSeedling <notifications@your-verified-domain>`.                   |
| `APP_BASE_URL`        | Public origin of the deployment, used in links. `https` in production.                       |
| `CRON_SECRET`         | Bearer secret for the scheduler (secret). With none set, the endpoint refuses every request. |
| `SUPABASE_SECRET_KEY` | Service credential used only by the delivery worker (secret).                                |

**Sending domain.** Use a domain or subdomain that DahliaSeedling controls, and verify it in Resend. Add the DNS records Resend shows for that domain, including its DKIM and SPF records, as Resend supplies them. Add a DMARC policy at that domain's DNS where appropriate. `EMAIL_FROM_ADDRESS` must use the verified domain. The application never changes DNS, and no DNS values are kept in the source.

**Scheduling.** `vercel.json` schedules `GET /api/email/deliver` every five minutes. The platform sends `Authorization: Bearer <CRON_SECRET>` when that variable is set. Check how often your plan allows scheduled requests, and adjust the schedule if needed.

**Secret handling.** `RESEND_API_KEY`, `CRON_SECRET` and `SUPABASE_SECRET_KEY` are read only by the email modules and `src/lib/supabase/service.ts`. None of them is in a client bundle, a browser response, a database row or committed configuration.

**Verification without the network.** Automated tests never call Resend. They use an injected provider at the adapter boundary, and a mocked SDK where the adapter itself is tested.

### Worker privileges

The scheduled worker authenticates to the database with `SUPABASE_SECRET_KEY`, a server-only credential. That key is the Supabase `service_role`, a platform role with `BYPASSRLS`. The platform fixes that attribute, and it cannot be changed here. **DahliaSeedling therefore does not rely on row-level security to constrain the worker.** The application's authorization boundary for this worker is the set of PostgreSQL object and function grants.

- The worker holds no table privileges on application tables. It cannot `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` or `TRIGGER` any of them, and the test suite attempts each prohibited operation as the worker's role inside a rolled-back transaction.
- The worker executes exactly five functions, by exact signature: `email_claim_due(integer, integer)`, `email_delivery_context(uuid, uuid)`, `email_record_sent(uuid, uuid, text)`, `email_record_retry(uuid, uuid, text)` and `email_record_failed(uuid, uuid, text)`. Each is `SECURITY DEFINER` with `search_path` set to empty, checks its claim token where one applies, and touches only the outbox and the reads it needs. None accepts dynamic SQL.
- The worker cannot execute any other application function, including report resolution, content removal, suspension administration, and messaging or block mutations.
- Scheduled invocation is protected separately by `CRON_SECRET` as a bearer token, compared in constant time. Without it, the endpoint refuses every request, before any outbox row is touched.

**Least-privilege repair.** The platform's default privileges had granted `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` on new application tables to `anon`, `authenticated` and `service_role`, and `EXECUTE` on functions to `PUBLIC`. The repair in `20261105100000_email_worker_least_privilege.sql` removes those privileges from the application schema only. It leaves `anon` and `authenticated` with the read and write grants their migrations name, and it preserves every function either role could already execute. `auth`, `storage` and the Supabase-managed schemas are not changed.

**Future objects, and what cannot be automated.** Table defaults for objects created by the `postgres` migration role grant nothing to `anon`, `authenticated` or `service_role`; this was tested with a real table. Function defaults cannot be relied on here: a new function still receives implicit `PUBLIC` execute, so no default rule is set for functions. Enforcing one would affect Supabase-managed behaviour and the functions that legitimate clients use, so it is not attempted.

**Convention for every privileged function.** When a migration introduces a function that a client or the worker must not call freely:

1. revoke execution from `PUBLIC` and from every role that does not need it, by exact signature;
2. grant execution only to the intended roles, by exact signature;
3. add or update a security test that proves the intended roles can execute it and the others cannot.

`tests/supabase/conventions.test.ts` enforces step 1 for every non-trigger function in every migration. Steps 2 and 3 are enforced by the regression tests named below. Review function privileges whenever a privileged DahliaSeedling function is introduced. The database does not protect future functions automatically.

### Deployment verification gates

Two checks are deployment gates, not implementation blockers. They need hosted credentials and cannot be run from the local environment.

- **Production/staging verification pending:** verify the effective `service_role` table and function privileges against the hosted Supabase project after migrations are applied.
- **Production verification pending:** send one availability email through the configured Resend account after the production or staging sending domain and credentials are installed.

Checklist for the hosted project, after applying migrations:

- `service_role` cannot `SELECT`, `INSERT`, `UPDATE`, `DELETE` or `TRUNCATE` application tables.
- `service_role` can execute exactly these five functions: `email_claim_due(integer, integer)`, `email_delivery_context(uuid, uuid)`, `email_record_sent(uuid, uuid, text)`, `email_record_retry(uuid, uuid, text)` and `email_record_failed(uuid, uuid, text)`.
- `service_role` cannot execute representative privileged functions, such as `resolve_report`, `admin_remove_content`, `admin_set_reported_suspension` and `send_message`.
- `anon` and `authenticated` hold no `TRUNCATE`, `REFERENCES`, `TRIGGER` or `MAINTAIN` on application tables.
- `GET /api/email/deliver` refuses a request without the `CRON_SECRET` bearer token.
- `RESEND_API_KEY` and `SUPABASE_SECRET_KEY` appear in no client bundle and no response.
- One availability email is delivered through the configured provider.

### Security mutations

- **Messaging (accepted in the earlier Phase 8 review):** the block check was removed from both `send_message` and the message trigger. The block test and the race test failed. The migration was restored byte for byte and the suite passed again.
- **Moderation:** the administrator check was removed from `resolve_report`. Three administrator-only tests failed, one of them the reported grower's attempt to resolve their own report. The migration was restored byte for byte and the moderation suite passed again.
- **Email delivery:** the scheduler's authorization was disabled in `delivery-route.ts`. Four authorization tests failed. The file was restored byte for byte and the tests passed again.
- **Worker privileges:** a direct `TRUNCATE` on `profiles` was restored for the worker's role in the repair migration. Two privilege tests failed, one of them the attempted truncation. The migration was restored byte for byte and the suite passed again.

### Verification

- Database, messaging (`tests/db/messaging.test.ts`, 26 tests): conversation uniqueness and context authorization; idempotent sends; participant-only reads; bundled notifications; read state; photograph visibility; block enforcement in both directions, with history kept and a concurrent block-and-send round; suspension; direct table writes refused.
- Database, moderation (`tests/db/moderation.test.ts`, 21 tests): reporting each target; the duplicate and self-report rules; target validation; a suspended reporter; a visitor; report privacy from the reported grower, an unrelated grower and a visitor; administrator-only functions; single resolution; soft removal that keeps Seedling provenance; removal of a private message refused; suspension through the existing authority, with restoration; an administrator's own account refused.
- Database, email (`tests/db/email.test.ts`, 18 tests): one outbox row per subscriber and event; a repeated event adds nothing; unsubscribed and unrelated growers get none; the subscriber's language is stored and an unknown one falls back to English; clients cannot read, write or call the functions; two concurrent claims never share a row; success, retry, exhaustion, permanent rejection and lapsed-lease takeover, with a stale worker refused; suppression for unsubscribe, suspension and a closed continuation; the address is read only at send time.
- Database, email delivery (`tests/db/email-delivery.test.ts`, 3 tests): the processor, running against the real database with only the provider replaced, moves a pending alert to `sent` once, leaves a second run with nothing to send, and keeps a temporary failure retryable with a code and no provider text.
- Database, service-role privileges (`tests/db/service-role-privileges.test.ts`, 68 tests): the worker holds no table privilege, checked against the catalog and by attempting each prohibited operation; it executes exactly the five functions; it cannot execute the sensitive functions; anon and authenticated keep the access they need and lose the four dangerous privileges; a table and a function created with the convention grant nothing they should not.
- Unit, email (`src/modules/email/*.test.ts`, 28 tests): the renderer in three languages with the English fallback, escaping and the content boundary; the Resend adapter's request shape and error classification; the processor's step order, suppression and idempotency key; the scheduler's authorization and the response that carries counts only.
- Browser, messaging (`tests/e2e/messaging.spec.ts`, phone and desktop): a conversation from a profile, a message, the other grower's new state, a message report, a block, the refused send, the blocker's history, the notification sentence, and the Dutch Inbox.
- Browser, moderation (`tests/e2e/moderation.spec.ts`): an Update and a profile reported on the phone project; a comment reported on the desktop project; an administrator reviewing a report, marking it reviewed and seeing the status change, with an ordinary grower refused by a not-found response. The administrator journey runs on both projects.

### Performance

Measured on a local dataset of one grower with 2,000 conversations and 10 messages in each, using `EXPLAIN ANALYZE`:

- thread view (200 messages of one conversation) used the conversation index and took about 0.07 ms;
- the Inbox (100 newest of 2,000 conversations) took about 1.1 ms, and the planner chose a sequential scan of the grower's conversations at this size;
- the unread count took about 4.5 ms with a sequential scan of messages.

The moderation changes do not alter these query paths. The administrator review list is bounded to 50 reports and is used only from the protected page. These are local measurements, not production guarantees.

### Not implemented

- Realtime updates. The Inbox and notifications refresh on navigation.
- Message edit and deletion, which the sources do not require.
- A notification count in the navigation, which the sources do not require.
- Removal of private messages by administrators. The sources list removal for public content only.
- Viewing a reported private message's photograph from the review page. The review shows its text as saved and records that a photograph was attached.
- Restoration of removed content. No source defines a restore path.

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

## Phase 3 verification

```bash
npm test                 # unit tests, including capture validation, limits and voice matching
npm run test:db          # media and storage protections, and Observation RLS (tests/db)
npm run test:e2e         # capture journeys, phone and desktop (tests/e2e/capture.spec.ts)
```

The storage tests (`tests/db/media.storage.test.ts`) check the bucket policies directly against `storage.objects`. The Observation tests (`tests/db/observations.rls.test.ts`) check visibility, correction, move, delete and suspension.

## Manual verification

1. Run `npm run supabase:start`, then `npm run db:reset`.
2. Run `npm run dev` and open http://localhost:3000 on a phone-sized browser window.
3. As a visitor: open Home, then tap Capture. You should land on sign-in with the destination preserved.
4. Create an account, then set up your display name and country. You should arrive at Capture.
5. Open Profile, then Edit profile. Change the bio and save.
6. Open View public profile, then open that URL in a private window. The bio is visible there, with no edit controls.
7. Sign out from Profile. Tap Profile again: you should be asked to sign in.
8. Try a wrong password. The message is generic and announced to screen readers.
9. As a signed-in grower, open Capture at about 390 × 844. Take or choose a photo and tap **Save privately**. The result shows the private confirmation, the photo, and the seedling it was added to.
10. Open the seedling. The Observation is listed under "Your private observations". Open it in a private window: the visitor sees the public seedling, but not the Observation.
11. On the Observation, choose **Change seedling**. The media stays the same, and no upload happens.

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
