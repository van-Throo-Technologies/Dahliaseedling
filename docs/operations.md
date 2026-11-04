# Operations and launch checklists

This document covers how operators inspect failures with existing infrastructure, the abuse-limit defaults, and the checklists that must be completed on hosted environments. Nothing here has been executed against a hosted environment. Each item is a task to perform and record.

## Inspecting errors and worker failures

No third-party monitoring provider is in use. Operators use the infrastructure already in place.

**Server log lines.** The application writes one JSON line per event to the server runtime's standard output. Read them in the hosting platform's runtime log viewer, filtering on `event`. The events and their fields are defined in `src/lib/logging/log.ts`:

| Event                    | Level                              | Fields                                                            | Meaning                                                                   |
| ------------------------ | ---------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `email_delivery_run`     | info (completed) or error (failed) | `outcome`, `count` (claimed), `status`, `route`, `code`           | One scheduled email run finished, or failed with `code` `delivery_failed` |
| `email_delivery_refused` | warn                               | `outcome` (`unauthorized` or `not_configured`), `status`, `route` | A scheduler request was refused. No secret is ever logged                 |

A log line never carries an address, a message body, a claim token, a signed URL, a transcript or an export. Fields outside the allowlist are dropped.

**Email outbox.** Email failures are recorded in the `email_outbox` table. A privileged operator can read the status without reading any address:

```sql
select kind, status, attempts, last_failure, count(*)
  from public.email_outbox
 group by kind, status, attempts, last_failure
 order by kind, status;
```

Rows reach `failed` after five attempts, with `last_failure = 'attempts_exhausted'` or the provider's failure code. Do not select `recipient_id` or join to `auth.users` for routine checks.

**Health.** `GET /api/health` reports only whether configuration is present and well formed. It makes no network calls.

**Abuse-limit refusals.** Refusals are shown to the grower in plain words. The counters are in `public.rate_counters`, readable only by a privileged operator. Counts by action are enough for operations; the table holds no content.

## Abuse-limit defaults

Defaults are provisional and deliberately generous. They stop scripted bursts and leave ordinary use alone. They are enforced by triggers in the database, so they hold for every route. Change them only in a migration, then update `tests/db/abuse-limits.test.ts`.

| Action                    | Limit | Window                | Rationale                                              |
| ------------------------- | ----- | --------------------- | ------------------------------------------------------ |
| Comment                   | 60    | per hour, per author  | Replies in a busy thread stay well below this          |
| Private message           | 120   | per hour, per sender  | Active conversations stay below this                   |
| Report                    | 20    | per day, per reporter | Reports are deliberate; a higher count suggests misuse |
| Rehome interest           | 30    | per day, per grower   | Interest in continuations is occasional                |
| Seed Offer interest       | 50    | per day, per grower   | Seed offers can attract more interest                  |
| Availability subscription | 50    | per day, per grower   | Subscribing to several Seedlings is ordinary           |

A refused write is not counted, because the refusal rolls back its own count. A repeated request that the database treats as a no-op, such as a duplicate message key or a repeated interest, still uses one attempt, while storing one row. The counter is kept for two days and is pruned as part of normal use, and pruning never removes a current window.

## Hosted security verification

Perform these against the hosted project, never against the local stack. Record the date, the operator and the result for each item.

- [ ] Row-level security is enabled on every table in `public`.
- [ ] `anon` and `authenticated` hold no `INSERT`, `UPDATE` or `DELETE` grant on any `public` table.
- [ ] `service_role` holds exactly the five email RPCs (`email_claim_due`, `email_delivery_context`, `email_record_failed`, `email_record_retry`, `email_record_sent`) and no table privilege.
- [ ] No trigger function is executable by `anon` or `authenticated`, and `admin_set_suspended` is not executable by `authenticated`.
- [ ] The set of `SECURITY DEFINER` functions executable by `anon` matches the allowlist in `tests/db/privilege-hardening.test.ts`.
- [ ] Storage policies on `avatars`, `private-media` and `public-media` match the migrations. The buckets are not public.
- [ ] Auth: the email-confirmation setting is the one decided under decision D5 of the Phase 10 readiness assessment. The password minimum is set. Redirect URLs list only the production origin.
- [ ] Auth rate limits are enabled.
- [ ] Environment: `NEXT_PUBLIC_SUPABASE_URL` points at the hosted project. `SUPABASE_SECRET_KEY`, `CRON_SECRET` and `RESEND_API_KEY` are set in the server environment only, with no `NEXT_PUBLIC_` prefix.
- [ ] Response headers on the production origin include `Content-Security-Policy`, `Permissions-Policy`, `X-Frame-Options` and `Strict-Transport-Security`. Check with `curl -sI <origin>`.

## Resend live test

Not executed. Perform once, with explicit authorisation, before any real availability email is sent.

- [ ] The sending domain is verified in Resend, and `EMAIL_FROM_ADDRESS` uses it.
- [ ] Use one approved test recipient, not a grower's address.
- [ ] Create one availability event for a test Seedling that the test recipient follows.
- [ ] Call `/api/email/deliver` once with `Authorization: Bearer <CRON_SECRET>`. Confirm one outbox row becomes `sent` with a provider message identifier.
- [ ] Call it again. Confirm no second send for the same event (the dedupe key holds).
- [ ] Record the outcome, then delete the test subscription.

## Scheduler configuration

- [ ] `vercel.json` schedules `/api/email/deliver` every five minutes.
- [ ] `CRON_SECRET` is set on the deployment.
- [ ] A request without the bearer returns 401: `curl -s -o /dev/null -w "%{http_code}" <origin>/api/email/deliver` returns `401`.
- [ ] The run log shows `email_delivery_run` events, and `email_delivery_refused` events appear only for deliberate tests.

## Backups

- [ ] The hosted project's backups are enabled, and their retention and recovery window are recorded. This depends on the hosting plan.
- [ ] Recovery-time and recovery-point targets are set by the owner (decision D8 of the Phase 10 readiness assessment).
- [ ] Storage object durability is confirmed for `private-media` and `public-media`.

## Restore rehearsal

- [ ] Restore the latest backup into a separate project, never the production project.
- [ ] Run the hosted-verification queries above against the restored project.
- [ ] Confirm a sample of Seedlings, Updates and conversation counts match production at the backup time.
- [ ] Record the time taken and any gap found. Delete the rehearsal project afterwards.

## Real-device voice verification

- [ ] Complete `docs/manual-qa-voice.md` on the devices listed there, in English, Dutch and French.
- [ ] Automated tests do not cover microphone input. Do not record this as passed on the basis of unit or browser tests.

## Privacy lifecycle (Phase 10B)

**What the database does now.** A grower can deactivate their account, which takes effect at once and stops new action. A deactivated account can then request erasure. Erasure clears the personal content the grower controls, and it leaves provenance, identifiers, parentage and the other participant's conversation history unchanged. The profile remains as a tombstone labelled "Former grower" with the non-geographic country code `XX`.

**What is outstanding, and why.** Erasure is never shown as completed while a step remains outstanding. Three steps are not yet performed by the application:

- **Sign-in identity removal.** Deleting a Supabase Auth identity needs a privileged credential that has not been approved. Until then the grower's sign-in still works, but a deactivated or erased account cannot take any action.
- **Original media removal.** Objects are queued in `storage_purge_queue` with state `awaiting_authorization`. Nothing deletes them until retention periods and operational authorization are approved.
- **Avatar removal.** The grower's own session removes the avatar object. If that removal fails, the step stays outstanding, and the object is then found by the orphan check below.

**Detecting work for an operator.** Administrators can run these read-only functions from the database:

```sql
select * from public.storage_orphan_candidates(500);    -- stored objects no live row references
select * from public.storage_purge_eligible(500);       -- queued objects no live row references
```

Neither function deletes anything.

**Retention periods.** No period is set. Retention categories are in `public.retention_policies`, and while a category has no period, applying it changes nothing. Setting one is an administrator action that requires a basis naming the legal review that approved it. Every application is recorded in `public.retention_runs`. Reports and administrator actions are never deleted, only their personal text is cleared.

**Export.** The grower's download is built in memory for that single request, and is not stored. The size cap of 256 MiB is an operational guard, not a retention period. A file the storage policy refuses is listed as missing in the archive's manifest. Each request is recorded in `privacy_requests`, with no content.

**Gates before any of this is used for real people.**

- Legal review of the privacy notice, the Terms of Use, the retention periods, the message rules, and whether the pseudonymous originator reference is personal data.
- A decision on the privileged credentials for sign-in identity removal and media purge, and their approval.
- Hosted verification that the sign-in identity can be removed without breaking sessions, and that the storage paths match the migrations.
- Confirmation of the backup retention period, which governs how long copies of erased data persist.
