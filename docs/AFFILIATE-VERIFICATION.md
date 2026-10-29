# Affiliate signup verification (email + SMS)

## Flow
1. `/affiliate/join`:
   - **New visitors** enter name, email, Pakistani mobile (03xx… or +92…), password and their affiliate application (payout, promotion plan, terms).
   - **Signed-in customers** enter their mobile number with the application.
2. The details are saved as a **pending signup** (`AffiliateSignup` table). No account is created and no application is submitted yet.
3. A 6-digit code goes to the email and a separate 6-digit code goes by SMS. The browser is linked to the pending signup by an httpOnly cookie.
4. `/affiliate/verify` shows **Email code** and **Mobile code** inputs, each with its own **Resend code** button.
5. When **both** codes are correct:
   - **New visitor:** the account is created with verified email and mobile, the visitor is signed in, and the affiliate application is submitted. Admin review still applies, unless auto-approve is on.
   - **Existing customer:** the mobile number (and email, if it wasn't verified) is marked verified on their account, and the application is submitted.
6. **Sign-in that already verifies the email** (e.g. Google sign-in, if added later): only the SMS code is required. A customer whose email and mobile are both already verified is not asked for codes again.

Normal customer registration (`/register`) is unchanged.

## Rules
| Rule | Value |
| --- | --- |
| Code length / expiry | 6 digits, 10 minutes |
| Resend | 60-second wait; at most 5 resends per hour per email or number |
| Wrong attempts | 5, then that code is deleted and a new one must be requested |
| Storage | Codes stored only as HMAC-SHA256 hashes (`OTP_SECRET`) bound to the signup and channel; compared in constant time |
| Duplicates | Signup is blocked if the email or mobile belongs to another account (checked at the start and again when completing) |
| Abuse | 10 signups per hour per connection; pending signups expire after 24 hours |
| Keys | Resend and Twilio keys are read only on the server |

## Providers
- **Email:** the existing Resend integration (`RESEND_API_KEY`, `EMAIL_FROM`).
- **SMS: Twilio** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM`). It delivers to all Pakistani networks (Jazz, Zong, Telenor, Ufone), and setup is self-service. Check Twilio's current per-SMS price for Pakistan.
  - The SMS sender is behind a small `SmsTransport` interface in `src/lib/sms.ts`, so a local Pakistani gateway can be added later if you want cheaper local delivery and a branded sender ID.

If an email or SMS can't be sent, the visitor sees a plain message and the pending signup is discarded, so they can try again.
