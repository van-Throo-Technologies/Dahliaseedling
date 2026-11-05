# Staging runbook: hosted Supabase, Vercel and Resend

This runbook prepares the staging deployment for a controlled beta. It lists what the repository already does, what the owner must do, in order, and how to verify each step. It contains no credentials. Variable names are listed in section 2; `.env.example` holds only the two browser-safe values. Never paste values into a ticket, a commit or a chat.

Staging is restricted to authorised operators until the gates in section 6 are closed.

## 1. What the repository already provides

| Concern              | Where it is                                                                                              | Notes                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Runtime              | `package.json` `engines.node` `>=22.12.0`; `.nvmrc` pins `22`                                            | Use Node 22 on Vercel                                                                                                   |
| Build and start      | `npm run build`, `npm run start`                                                                         | Next.js 16 App Router                                                                                                   |
| Schema               | `supabase/migrations/` (28 files, applied in name order)                                                 | Forward-only; never edit a committed migration. Privileges are explicit: see the note after this table                  |
| Storage buckets      | Created by migrations with `on conflict (id) do nothing`                                                 | `avatars` (public read, 2 MB), `private-media` (private, 50 MB), `public-media` (private, 5 MB, WebP)                   |
| Storage access       | Owner-folder policies; signed URLs for private media                                                     | Defined in migrations, no manual setup                                                                                  |
| Scheduler            | No Vercel cron. The Hobby plan cannot run a five-minute schedule. `vercel.json` sets only region `fra1`  | Staging will call `/api/email/deliver` from Supabase pg_cron, pg_net and Vault, after verification (section 3, step 16) |
| Worker authorisation | `src/app/api/email/deliver/route.ts`, constant-time bearer check                                         | Refuses every request without the secret                                                                                |
| Health               | `GET /api/health`                                                                                        | 200 when configuration is complete; 503 and the missing names otherwise. No network calls                               |
| Security headers     | `next.config.ts` via `src/lib/security/headers.ts`                                                       | CSP, Permissions-Policy, framing, HSTS in production                                                                    |
| Logs                 | Structured JSON lines on standard output (`src/lib/logging/log.ts`)                                      | Read in the Vercel runtime logs, filter on `event`                                                                      |
| Sign-up and links    | `/auth/confirm` verifies confirmation and invitation links; `/auth/set-password` completes an invitation | Public sign-up is refused by Supabase when its switch is off (section 2b)                                               |
| Admin bootstrap      | README, "Admin access": insert one `admin_users` row                                                     | Run once, by an operator, after the operator's own account exists                                                       |

**Privilege model.** Hosted Supabase gives `anon`, `authenticated` and `service_role` broad rights on new objects by default. The migrations revoke those defaults and then grant exactly what the application uses. Any new table or function must be granted explicitly in its own migration. The privilege tests in `tests/db/privilege-model.test.ts` pin the expected grants and fail when one is missing or unexpected.

**Local hosted-equivalent testing.** `supabase/roles.sql` recreates the hosted default rights in the local database. `npm run db:reset` applies it, so `npm run test:db` and `npm run test:e2e` run against the same privilege model as staging. This file is for the local stack only. Never pass `--include-roles` to any command that targets the hosted project.

## 2. Environment variables (names only)

Set these on the Vercel project for the staging environment. Mark the secret values as sensitive in Vercel.

| Name                                   | Public? | Purpose                                       | Required                                         |
| -------------------------------------- | ------- | --------------------------------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | yes     | Hosted project URL                            | yes                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes     | Hosted publishable key                        | yes                                              |
| `SUPABASE_SECRET_KEY`                  | **no**  | Email worker only (service client)            | yes, for email                                   |
| `RESEND_API_KEY`                       | **no**  | Resend API key                                | yes, for email                                   |
| `EMAIL_FROM_ADDRESS`                   | no      | From address on the verified Resend domain    | yes, for email                                   |
| `APP_BASE_URL`                         | no      | Public HTTPS origin, used in email links      | yes, for email                                   |
| `CRON_SECRET`                          | **no**  | Bearer secret checked by `/api/email/deliver` | yes, for email                                   |
| `APP_BUILD_ID`                         | no      | Short build label for feedback records        | optional (Vercel's commit SHA is used if absent) |

Vercel provides `VERCEL_GIT_COMMIT_SHA` automatically. Never prefix a secret with `NEXT_PUBLIC_`.

**Needed by stage** (checked against the code, which reads each name in one place):

- **Build:** none. The app builds and starts without any of these set.
- **Initial use of the app:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Without them, sign-in is unavailable and `/api/health` returns 503 naming them. The health check needs no other variable.
- **Email delivery only:** `SUPABASE_SECRET_KEY` (the delivery worker's service client), `CRON_SECRET` (the bearer check on `/api/email/deliver`), `RESEND_API_KEY`, and `EMAIL_FROM_ADDRESS`. The worker refuses to run until all are present, and the route refuses every request without `CRON_SECRET`.
- **After the final HTTPS origin exists:** `APP_BASE_URL`. Email links are built from it, and it must be `https` outside localhost. The Supabase Site URL is set in the Auth dashboard, not in this project's environment.
- **Optional:** `APP_BUILD_ID`. Vercel's commit SHA is used when it is absent.

## 2b. Supabase Auth settings, email templates and invitations

Set these in the hosted project's Authentication settings. None of them is applied yet. "Before the Vercel URL" means the setting can be made before step 9.

| Setting                    | Value                                                                                                                                                  | Before the Vercel URL? |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Email provider             | Enabled, email and password                                                                                                                            | yes                    |
| Confirm email              | On                                                                                                                                                     | yes                    |
| Allow new users to sign up | **Off.** Supabase then refuses public sign-up for everyone, including direct API calls. Invited users are not affected.                                | yes                    |
| Minimum password length    | 8, matching the application's rule                                                                                                                     | yes                    |
| Site URL                   | `https://<staging origin>`, the origin from step 9                                                                                                     | no                     |
| Additional redirect URLs   | Leave empty. The links carry a token hash, and the application does not use a redirect target from a link.                                             | yes                    |
| JWT expiry                 | 3600 seconds                                                                                                                                           | yes                    |
| Refresh token rotation     | On, reuse interval 10 seconds                                                                                                                          | yes                    |
| Rate limits                | On, at the defaults                                                                                                                                    | yes                    |
| SMTP                       | Custom SMTP through Resend. Supabase's built-in sender is for development and is limited, so authentication email needs the Resend domain from step 3. | after step 3           |

**Email templates.** In Authentication, Email Templates, replace the links in the two templates below. The default `{{ .ConfirmationURL }}` sends the visitor through Supabase's own redirect. That route does not give this application a token it can verify on the server, so it must not be used.

- **Confirm signup:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
- **Invite user:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`

Supabase sends one template per email type, not one per language. Choose one language for the beta and have the wording reviewed by a native speaker before inviting testers (see section 6).

**Invitation-only registration.** Two mechanisms, and only one of them is a switch:

- **Global sign-up switch (Supabase).** With "Allow new users to sign up" off, the server refuses `signUp` for every visitor. This is the enforcement. The sign-up page is not relied on to hide anything. When the server refuses, the page shows an invitation-only notice.
- **Invitation acceptance (Supabase).** An operator invites an address from the Auth dashboard (Users, Invite user). Supabase creates the account and emails the invite template. The link opens `/auth/confirm`, which signs the invitee in and sends them to `/auth/set-password` to choose a password.

  Only an invited account can set a password there. The check is the account's `invited_at` from Supabase Auth, together with a completion record in `invitation_completions`, which is written once the password is stored. An ordinary account is refused, and so is a repeat after completion. A stolen ordinary session therefore cannot open the page or change a password. The invitation link itself is single use.

  Known limit: a session obtained from an invitation link that has not yet been completed can set that account's password. That session comes only from the emailed link, so it is the same trust as the link.

The local `supabase/config.toml` keeps sign-up on so the automated tests can create accounts. That setting is for the local stack only.

## 3. Owner actions, in execution order

Each step lists who acts, what to record, and how to confirm it. Do not proceed to a step before the previous one is confirmed.

1. **Choose the hosting region** for Supabase and Vercel. Record the choice. _Owner decision; affects processor and transfer terms, so counsel should confirm it._
2. **Create the hosted Supabase project** in that region. Record its project reference. Do not reuse the local stack.
3. **Create the Resend account**, verify the sending domain, and create a sending API key. Record the from-address. Do not send a test email yet (step 11).
4. **Create a dedicated Vercel project for staging**, linked to the repository. Do not deploy yet. Required settings, all before the first deployment exists:
   - **Plan:** Hobby, the current plan of the vanThroo team. Hobby cannot run the five-minute email schedule, so the schedule is not a Vercel cron (see section 1). The production branch is still set to `staging`, so that the production deployment protection and environment apply to it.
   - **Region:** Frankfurt (`fra1`), set in `vercel.json`, next to the Supabase project in `eu-central-1`.
   - **Deployment protection:** on, so the deployment is not reachable by the public before the operators are set up.
5. **Set the environment variables** from section 2 on the Vercel project, for the staging environment only.
6. **Configure hosted Auth** in the Supabase dashboard, using section 2b, except the Site URL. Turn "Allow new users to sign up" off before any invitation is sent. The Site URL is set after step 9. Do not invite anyone until both are done.
7. **Apply the migrations** to the hosted project from the repository, with the Supabase CLI:
   ```
   supabase link --project-ref <project-ref>
   supabase db push
   ```
   Never add `--include-roles`: `supabase/roles.sql` is local only. Confirm the applied migration list matches `supabase/migrations/` (28 files, including `20261110090000_privilege_model_correction.sql`, `20261110100000_revoke_legacy_journey_execute.sql` and `20261111090000_invitation_password_state.sql`). Do not run `npm run db:reset` against the hosted project; that command is for the local stack only.
8. **Check the hosted schema** with read-only queries in the Supabase SQL editor:
   - Every public table has row-level security enabled: `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;` should return no rows.
   - `anon` and `authenticated` hold no table-level insert, update or delete on public tables. Their writes are column-level only, on the profile, observation, Seedling and series columns the application uses.
   - `anon` executes 21 public functions and `authenticated` executes 101. `list_seedling_updates(uuid)` is executable by neither role, and PUBLIC holds no execute grant on it.
   - `storage.buckets` holds `avatars`, `private-media` and `public-media`, with `private-media` and `public-media` not public.
   - The `service_role` executes exactly the five email functions (`email_claim_due`, `email_delivery_context`, `email_record_failed`, `email_record_retry`, `email_record_sent`) and holds no table rights.
9. **Deploy** the staging branch on Vercel. Record the deployment URL. This is the HTTPS origin for the Site URL (section 2b), the email templates and `APP_BASE_URL`. If it differs from what was configured, correct them and redeploy before any invitation is sent.
10. **Verify the deployment** from the outside:
    - `curl -s https://<origin>/api/health` returns 200 with `"status":"ok"`.
    - `curl -s -o /dev/null -w "%{http_code}" https://<origin>/api/email/deliver` returns 401 (no bearer token).
    - `curl -sI https://<origin>/` shows `Content-Security-Policy`, `Permissions-Policy`, `X-Frame-Options` and `Strict-Transport-Security`.
    - `curl -sI https://<origin>/profile` shows `Cache-Control: private, no-store`.
11. **Resend live test.** _Requires explicit owner authorisation for each send._ Use one approved test recipient. Confirm one outbox row moves to `sent` with a provider message identifier, and that a second scheduler run does not send it again. Then delete the test subscription.
12. **Create the first administrator.** With sign-up off, the operator's account is created by invitation: invite the operator's address from the Auth dashboard, open the link, and choose a password. Then find the user identifier in the Auth dashboard and run the README's `admin_users` insert in the SQL editor. Record that the bootstrap was done. Create a second administrator the same way.
13. **Confirm access.** Deployment protection was set in step 4. Confirm it is still enabled before inviting anyone. _Owner decision on who the operators are._
14. **Backups.** Confirm point-in-time backups are enabled for the hosted project and record the retention period the plan provides. _Owner decision on recovery-time and recovery-point targets._
15. **Restore rehearsal.** Restore the latest backup into a separate project, run the checks from step 8 there, and record the time taken. Delete the rehearsal project afterwards.
16. **Email scheduler (separate approval).** Only after steps 1 to 13 are verified and the owner approves. Enable `pg_cron` and `pg_net` on the staging Supabase project. Store `CRON_SECRET` in Supabase Vault, not in SQL text. Schedule a five-minute job that posts to `https://<origin>/api/email/deliver` with the bearer secret read from Vault. The deployment protection bypass must also be supplied, since protection covers the whole deployment. Verify with the job history and the `email_delivery_run` log event before relying on it.

## 4. Operations

- **Logs:** Vercel runtime logs. Filter on `event`. The events are `email_delivery_run`, `email_delivery_refused` and `account_export`, each with an `outcome`. Log lines never contain addresses, message text, tokens, signed URLs or exports.
- **Email failures:** query `email_outbox` status counts, without selecting recipients (the query is in `docs/operations.md`).
- **Feedback:** administrators review `/admin/feedback`.
- **Privacy requests:** handled through the operator procedure in `docs/operations.md`. Erasure of the sign-in identity and of original media is not automatic and needs owner approval per request.

## 5. Rollback

- **Application:** promote the previous Vercel deployment. This takes effect immediately and does not touch the database.
- **Database:** migrations are forward-only. A bad migration is corrected by a new migration. Do not drop or edit tables by hand. For data loss, restore from the backup into a separate project first, and decide the cut-over with the owner.
- **Environment:** revert the variable in Vercel and redeploy.

## 6. Gates that stay closed until authorised

Staging stays restricted to operators until all of these are complete:

- The Privacy Notice and Terms have been reviewed by a qualified adviser. Until then, the pages at `/legal/privacy` and `/legal/terms` show the review-pending notice, and must not be presented as final.
- Personal-data request handling is operational: the mailbox, the response procedure, and a named person.
- Handling for sign-in identity removal and original-media removal is approved in writing. The application does not perform either automatically.
- The hosting region, data processing terms and backup retention are verified with each provider.
- Error visibility is decided: runtime logs only, or an external provider approved by the owner.
- Password recovery is decided. The application has no reset flow, so a tester who forgets a password cannot recover it by themselves. Choose the operator procedure, or build the flow, before testers rely on their accounts.
- The Auth email templates and the invitation-only notice are reviewed in Dutch and French by a native speaker.

## 7. Confirmed deployment blockers

None technical. Every item above depends on an external account, a credential, or an owner decision. The repository's build, migrations, health endpoint, headers, scheduler and worker authorisation all verify locally.
