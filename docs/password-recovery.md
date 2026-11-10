# Password recovery: manual steps and follow-ups

The self-service flow is in `src/app/forgot-password`, `src/app/auth/reset-password` and `src/app/auth/confirm`. Its templates are in `supabase/email-templates/recovery*`. Invitation links are unchanged.

## Manual Supabase staging steps

1. **Authentication → Email Templates → Reset password.** Paste `recovery-subject.txt` as the subject, `recovery.html` as the body, and `recovery.txt` as the plain-text body. The link must stay `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. Do not use `{{ .ConfirmationURL }}`.
2. **Authentication → URL Configuration.** Confirm the Site URL is the staging origin. The redirect list needs no change.
3. **SMTP.** Confirm the Resend sender is configured and verified.
4. **Keep sign-ups off.** Do not change the Invite user template.

## Residual items for follow-up

- **Request flooding.** The request form has no limit of its own. Someone could trigger reset emails to a victim's inbox. Supabase's email rate limits are the only control today.
- **Rate-limit response.** A rate-limit refusal shows its own message. Whether Supabase applies its limit per address, and so whether the refusal could reveal an account, has not been confirmed.
- **Reset mark.** The 15-minute cookie holds a flag, not the user's ID. It is only valid in the browser that opened the link, so the risk is low.
- **Recovery session.** A valid link signs the browser in briefly, before the new password is saved. This is the usual behaviour, and the link is single-use.
- **Copy review.** The Dutch and French recovery messages need review by a native speaker.
