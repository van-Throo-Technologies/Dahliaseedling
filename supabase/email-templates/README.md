# Supabase email templates

These files are the source for the **Invite user** and **Reset password** templates in the hosted Supabase project. They are not applied by deployment. Supabase stores its email templates in the Auth dashboard, so the staging project must be updated by hand, after founder approval (see `docs/invitation-email.md`).

- `invite-subject.txt`: the subject line.
- `invite.html`: the HTML body.
- `invite.txt`: the plain-text body, sent with the HTML.
- `assets/founder-seedling.jpg`: the founder's photograph, the file hosted in the public `email-assets` bucket. The template links to that hosted copy, not to this file.

The only Supabase variables used are `{{ .SiteURL }}` and `{{ .TokenHash }}`. The link goes to `/auth/confirm`, which verifies the token on the server. Do not use `{{ .ConfirmationURL }}`, because it bypasses that check.

Password recovery (**Reset password** template):

- `recovery-subject.txt`: the subject line.
- `recovery.html`: the HTML body. Its button and fallback link are `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
- `recovery.txt`: the plain-text body.

A recovery link lands on `/auth/reset-password`, through the same server-side check as the other links. Each template must be pasted into its own Supabase template, by hand.
