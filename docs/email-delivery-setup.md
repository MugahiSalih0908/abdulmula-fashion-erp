# Transactional email setup for Abdulmula Fashion ERP

The backend uses Resend for staff activation, staff invitations, password recovery, and other transactional messages. Email is intentionally disabled unless the backend environment explicitly enables it.

## Before enabling live delivery

1. Register and activate \`abdulmulafashion.com\` with Hostinger.
2. Create a Resend account and add \`abdulmulafashion.com\` as a sending domain.
3. Copy the DNS records supplied by Resend into Hostinger DNS exactly as provided.
4. Wait until Resend marks the sending domain as verified.
5. Create a Resend API key for the production backend.
6. Add the environment variables below to the Render backend service (never commit API keys to GitHub).
7. Redeploy the backend and use Email Center's test button to verify a message to the signed-in administrator.

## Render backend environment variables

Set these values only after the Resend domain is verified:

\`\`\`dotenv
EMAIL_DELIVERY_MODE=live
RESEND_API_KEY=<your-resend-api-key>
EMAIL_FROM=Abdulmula Fashion <noreply@abdulmulafashion.com>
EMAIL_SENDING_DOMAIN=abdulmulafashion.com
EMAIL_DOMAIN_VERIFIED=true
FRONTEND_URL=https://<your-production-frontend-domain>
\`\`\`

Replace the placeholder API key and frontend URL with the actual values. Do not paste the key into source code, commit it, or send it in chat. Set \`EMAIL_DOMAIN_VERIFIED=true\` only after Resend itself shows the domain as verified.

## Optional restricted test mode

Before the custom domain is verified, the backend can be tested with a Resend-supported test sender. The recipient must be explicitly allow-listed and accepted by the Resend account:

\`\`\`dotenv
EMAIL_DELIVERY_MODE=test
RESEND_API_KEY=<your-resend-api-key>
EMAIL_FROM=Abdulmula Test <onboarding@resend.dev>
EMAIL_TEST_RECIPIENTS=<the-exact-verified-test-inbox>
FRONTEND_URL=https://<your-production-frontend-domain>
\`\`\`

The signed-in administrator's email address must exactly match an entry in \`EMAIL_TEST_RECIPIENTS\`. Test mode is not a substitute for a verified domain when emailing staff or customers.

## How staff creation and invitations work

- **Add Staff** creates a pending user record immediately, then attempts to send an activation email. The user can sign in only after activating the account and setting a password.
- **Send Invitation** creates a pending invitation record. It creates the actual user account only after the recipient opens the invitation, chooses a password, and accepts it.
- If email delivery is blocked or fails, the pending account/invitation remains available. Correct the email configuration, then use **Resend activation** or **Manage invitations → Resend**.
- If the provider response is uncertain, check Email Center before retrying to avoid duplicate messages.

## Diagnostic signals

Email Center reports the delivery mode, whether the Resend key and sender are configured, whether the sending domain is verified, and any configuration issues. It never displays the API key.

\`sent\` means Resend accepted the message; it does not guarantee the recipient's mailbox delivered it. Check provider delivery events for delivered, bounced, or complained states.
