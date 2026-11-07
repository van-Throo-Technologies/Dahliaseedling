# Invitation email: cause, installation and retest

## Why the generic email was sent

- The repository holds no invitation template. Its only transactional email is the availability alert (`src/i18n/messages/email.ts`), which the application sends itself.
- The invitation is sent by Supabase Auth, from the **Invite user** template in the Auth dashboard. Deploying the application does not change that template. Supabase keeps it in the hosted project.
- The runbook (section 2b) asks the operator to replace only the link in that template. It does not provide a designed template, so the email kept Supabase's default layout and copy. The link itself works, which is why the password page opened.
- Sender display name and subject are also set in the Supabase dashboard (SMTP settings and the template). Resend supplies the mail transport and the sending domain. It does not set the design or the copy.

## What the template is

Files in `supabase/email-templates/`:

- `invite-subject.txt`: subject, "You're invited to DahliaSeedling".
- `invite.html`: the designed body, table-based for mail clients, with inline styles, a 600 px card that stacks on narrow screens, and a plain-text link for clients that block buttons.
- `invite.txt`: the plain-text body.

Palette, from the design system: Porcelain `#FBF7F1` background, Aubergine `#382733` headings and button text, Apricot `#F29B72` button, Muted Plum `#8B6177` secondary text, Sand `#E8DDD2` borders, Charcoal `#29272A` body text. The wordmark is text in Georgia, because the approved display face (Fraunces) is not reliably available in mail clients, and the design system does not approve a logo.

The only variables are `{{ .SiteURL }}` and `{{ .TokenHash }}`, with the link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`. Do not use `{{ .ConfirmationURL }}`.

Rendering checked locally in Chromium at 390 px and 900 px, with sample values. There was no horizontal overflow. Real mail clients have not been checked yet.

## Copy: approved

Subject: `Your invitation to DahliaSeedling`

The body, the button and the explanation are the wording the founder approved. They are in `invite.html` and `invite.txt`, word for word. The button reads "Accept invitation". The explanation under "Why did you receive this email?" says the invitation is intended for the recipient's address and can be ignored if not expected.

The Dutch and French versions are not written. The runbook requires a native-speaker review before either is sent.

## Hosted configuration (not applied; needs your approval)

1. **Authentication, Email Templates, Invite user.** Set the subject from `invite-subject.txt`. Paste `invite.html` as the body. Paste `invite.txt` into the plain-text body if the dashboard offers one. Save. Leave the other templates unchanged.
2. **Authentication, SMTP Settings.** Confirm the sender name is `DahliaSeedling` and the sender address is `notifications@dahliaseedling.app`. Confirm the Resend domain shows as verified. Do not change the Resend DNS records.
3. **Authentication, URL Configuration.** Confirm the Site URL is the staging origin, and that the redirect list does not need the application's own paths, as in runbook section 2b.
4. Send one invitation from **Users, Invite user**, to the approved test address.

The Supabase settings endpoint does not show the Site URL, the template or the sender name, so I cannot read these from here. Checking them needs the dashboard.

## Controlled retest

Recipient: `janinevanthroo@gmail.com`, the address you approved. No other recipient.

1. Check Gmail on desktop: sender "DahliaSeedling", subject, preview text, the layout, the button and the fallback link. Open "Show original" and confirm SPF, DKIM and DMARC pass.
2. Check the same message on the Gmail mobile app: the button is tappable, and the text reads without zooming.
3. Tap the button. It should open the staging `/auth/confirm` page, then the password page.
4. Set a password, complete the display name and country, and confirm the flow returns to the Feed (`/`).
5. Open the same link again. It should be refused, because it works once.
6. Confirm that no administrator role was added. Administrator access is a separate approval.

Record each step, with the device and the result.

## Open decisions

- The **olive accent** you asked for is not in the approved palette. The design shows Muted Plum as the secondary accent, so the draft uses that. Olive would need to be added to the design system first.
- The **copy** needs your approval. The Dutch and French versions need a native-speaker review.
- The **DNS** for the sending domain is unresolved (see the domain notes). Gmail may mark the mail as unverified until the sending records are confirmed in Resend.
