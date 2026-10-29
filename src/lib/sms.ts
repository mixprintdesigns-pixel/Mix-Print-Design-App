import "server-only";

export type Sms = { to: string; body: string };
export type SmsResult = { sent: true } | { sent: false; error: string };
export type SmsTransport = (sms: Sms) => Promise<SmsResult>;

/**
 * Sends SMS through Twilio (https://www.twilio.com), which delivers to all Pakistani networks.
 * Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either TWILIO_MESSAGING_SERVICE_SID (recommended)
 * or TWILIO_FROM (a Twilio number or approved sender ID). Keys are only ever read on the server.
 */
export const twilioTransport: SmsTransport = async ({ to, body }) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || (!service && !from)) return { sent: false, error: "SMS is not configured (Twilio keys missing)." };

  const form = new URLSearchParams({ To: to, Body: body, ...(service ? { MessagingServiceSid: service } : { From: from! }) });
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { sent: false, error: `SMS service returned ${response.status}: ${(await response.text()).slice(0, 200)}` };
    return { sent: true };
  } catch (error) {
    return { sent: false, error: `SMS could not be sent: ${(error as Error).message}` };
  }
};
