# Remove Resend and Replace with Nodemailer

## Goal Description
Replace the Resend email service with Gmail SMTP using Nodemailer across the entire project. This includes installing Nodemailer, creating a reusable email utility, updating all email sending logic (including cloud functions, API routes, and any other places that send OTP, verification, password reset, welcome emails, contest reminders, etc.), removing Resend dependencies and environment variables, and ensuring the solution works locally and on Vercel.

## User Review Required
> [!IMPORTANT]
> This change will modify several core files and replace the email sending mechanism. Confirm that you want to proceed with the full replacement.

## Open Questions
> [!QUESTION]
> Do you want to keep the existing `app/api/send-email/route.ts` endpoint as a wrapper around Nodemailer (i.e., still expose it) or remove it entirely?

## Proposed Changes
---
### Dependencies
- Add `nodemailer` to `package.json`.
- Remove `resend` related packages (if any).

---
### New Utility
#### [NEW] lib/email.ts
Create a reusable email utility that reads `GMAIL_USER` and `GMAIL_APP_PASSWORD` from environment variables, configures Nodemailer transport, and exports a `sendEmail` function.

---
### Updated Files
#### [MODIFY] functions/src/index.ts
- Remove `RESEND_API_KEY` and `REMINDER_FROM_EMAIL` secret definitions.
- Import and use `sendEmail` from `lib/email.ts` for reminder and contest emails.
- Remove any Resend-specific fetch calls.
- Adjust secret handling; no longer need Resend secrets.

#### [MODIFY] app/api/send-email/route.ts
- Replace Resend fetch with `sendEmail` utility.
- Validate environment variables `GMAIL_USER` and `GMAIL_APP_PASSWORD`.
- Return appropriate JSON responses.

#### [MODIFY] Any OTP / verification / password reset email logic (search for `fetch("https://api.resend.com/emails"` and replace):
- Update to use `sendEmail` utility.
- Ensure subject and body templates remain unchanged.

#### [MODIFY] .env.local
- Remove `RESEND_API_KEY` and `REMINDER_FROM_EMAIL` entries.
- Add:
  ```
  GMAIL_USER=email.sender.22010@gmail.com
  GMAIL_APP_PASSWORD=<your-app-password>
  ```

---
### Cleanup
- Remove all `import` statements referencing Resend.
- Delete any Resend-specific TypeScript types or helper files.
- Run a repo-wide search for `RESEND_API_KEY` and ensure all references are removed.

---
## Verification Plan
### Automated Tests
- Run existing unit tests (if any) to ensure they still pass.
- Add a simple integration test that calls the email utility with a mock transport to verify payload structure.

### Manual Verification
- Locally run the app, trigger a reminder email and verify it arrives in Gmail inbox.
- Deploy to Vercel preview, trigger the same flow, and confirm email delivery.
- Check that contest reminder emails are sent correctly.
- Ensure no runtime errors related to missing Resend secrets.

---
## Post‑Change Checklist
- [ ] `npm install` updates dependencies.
- [ ] `.env.local` updated with Gmail credentials.
- [ ] All Resend code removed.
- [ ] Email utility works in both Node (cloud functions) and Vercel serverless environment.
- [ ] Documentation updated in README for email configuration.
