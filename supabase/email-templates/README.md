# Supabase invitation email

These files are the source for the **Invite user** template in the hosted Supabase project. They are not applied by deployment. Supabase stores its email templates in the Auth dashboard, so the staging project must be updated by hand, after founder approval (see `docs/invitation-email.md`).

- `invite-subject.txt`: the subject line.
- `invite.html`: the HTML body.
- `invite.txt`: the plain-text body, sent with the HTML.

The only Supabase variables used are `{{ .SiteURL }}` and `{{ .TokenHash }}`. The link goes to `/auth/confirm`, which verifies the token on the server. Do not use `{{ .ConfirmationURL }}`, because it bypasses that check.
