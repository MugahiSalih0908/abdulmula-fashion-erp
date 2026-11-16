# Production domain and email rollout — abdulmulafashion.com

## Current state

- Domain is registered at Hostinger and the Hostinger domain list showed Active.
- Vercel project: abdulmula-fashion-erp.
- Transactional email provider: Resend.
- The backend defaults to EMAIL_DELIVERY_MODE=disabled; live sending is intentionally blocked until verification is complete.

## 1. Add the domain to Vercel

In Vercel:
1. Open the abdulmula-fashion-erp project.
2. Open Settings → Domains.
3. Add abdulmulafashion.com.
4. Add www.abdulmulafashion.com too, then choose the preferred primary hostname.
5. Copy the exact DNS values Vercel displays for the apex and www. If Vercel displays an ownership TXT record, copy that value too.

Do not change nameservers for this setup. Use Hostinger as the DNS manager only if the domain's active nameservers point to Hostinger. If they point elsewhere, make the DNS edits at the active DNS provider.

## 2. Add Vercel records in Hostinger

Before editing:
- Open Domains → abdulmulafashion.com → DNS / Nameservers → DNS records.
- Take screenshots or export the existing DNS zone.
- Identify current A, AAAA, CNAME, MX, TXT and SPF records.

Add/update only the website records Vercel requests:
- Apex/root hostname: normally an A record at host @, using the exact IP shown in Vercel.
- www: normally a CNAME record, using the exact target shown in Vercel.
- Any Vercel ownership TXT record: copy exactly.

Do not reset the DNS zone, replace nameservers, or delete existing email MX/TXT records. If a conflicting website A/AAAA/CNAME record exists, compare it with the Vercel instructions before replacing that website record. Hostinger's default TTL is typically 14400 seconds; DNS propagation can take up to 24 hours.

## 3. Verify the sending domain in Resend

In Resend:
1. Open Domains and add abdulmulafashion.com.
2. Copy every record Resend displays for the domain: DKIM, SPF, MX/return-path, and any ownership record.
3. Add those exact values in the active DNS zone.

Do not guess SPF/DKIM/MX values. They are generated for the Resend domain configuration. Do not create a second SPF record for the same hostname; if Resend's instructions conflict with an existing SPF record, reconcile them rather than adding a duplicate. Preserve existing root-domain MX records used by any mailbox service. Resend may place its return-path records on a subdomain such as send; follow the exact record names it shows.

Return to Resend and run verification. Wait for its dashboard to report the domain and the required sending records as verified. DMARC is recommended for deliverability, but preserve any existing DMARC policy and do not add a duplicate record.

## 4. Configure backend and frontend environments

Set these in the backend hosting service (Render), not in Git:

| Variable | Value / action |
| --- | --- |
| RESEND_API_KEY | Secret API key from Resend |
| EMAIL_FROM | Abdulmula Fashion <no-reply@abdulmulafashion.com> |
| EMAIL_DELIVERY_MODE | test initially |
| EMAIL_TEST_RECIPIENTS | Comma-separated exact QA inbox addresses |
| EMAIL_DOMAIN_VERIFIED | false until Resend reports verified |
| EMAIL_SENDING_DOMAIN | abdulmulafashion.com |
| FRONTEND_URL | https://abdulmulafashion.com |
| CLIENT_URL | https://abdulmulafashion.com |
| CLIENT_PREVIEW_URL | Optional exact preview origin if needed |

After setting variables, redeploy the backend. Never commit the API key or paste it into chat.

In Vercel project environment settings, ensure VITE_API_URL points to the existing backend API base URL (including /api) if it differs from the current Render default. Redeploy the frontend after changing environment variables.

## 5. Test with allow-listed Gmail inboxes

Keep email in test mode while verifying:
1. Put the exact QA Gmail address(es) in EMAIL_TEST_RECIPIENTS.
2. Sign in with the existing administrator account.
3. In Staff, create one test account for each role: Staff, Manager, Admin. Use unique email addresses (Gmail plus-address aliases may be used if they are accepted as distinct addresses by the app).
4. Confirm the account record is created and its email status is sent.
5. Check Inbox, Promotions, and Spam/Junk for the welcome/activation message.
6. Open each activation link, set a unique password, and sign in.
7. Verify permissions: Staff can use permitted POS/product workflows; Manager can access manager workspaces; Admin can manage staff and invitations.
8. Separately test the invitation workflow from the invitation dialog: send one invitation, open it, accept it, set the account credentials, and sign in.

Creating a staff record and sending an invitation are separate workflows. The /api/staff creation endpoint is admin-only. Invitation creation is also admin-only. If an email fails, the account/invitation may still be saved as pending; check Email Center and use the retry/resend action after correcting configuration.

## 6. Enable live delivery

Only after:
- Vercel reports the custom domain as valid.
- Resend reports the domain and sending records verified.
- Test-mode emails reach the allow-listed inboxes.
- Activation and invitation links open the correct custom domain.

Then update backend environment:
- EMAIL_DOMAIN_VERIFIED=true
- EMAIL_DELIVERY_MODE=live

Keep EMAIL_SENDING_DOMAIN=abdulmulafashion.com and ensure EMAIL_FROM uses an address on that same domain. Redeploy the backend and send one final controlled test.

## Safety rules

- Do not change nameservers for this rollout.
- Do not use Hostinger's Reset DNS records action.
- Do not delete or overwrite existing MX, SPF, DKIM, DMARC or other TXT records without checking what service uses them.
- Do not switch to live email before Resend verification and a successful allow-listed test.
- Do not create test Admin accounts on a live business dataset unless the owner has explicitly approved the test accounts and their email addresses.
