import "server-only";

export type Email = { to: string; subject: string; text: string; replyTo?: string };
export type SendResult = { sent: true } | { sent: false; error: string };
export type EmailTransport = (email: Email) => Promise<SendResult>;

/**
 * Sends through Resend (https://resend.com) when RESEND_API_KEY is set. EMAIL_FROM must be an address
 * on a domain verified in Resend (e.g. "Mix Print Design <noreply@mixprint.pk>").
 */
export const resendTransport: EmailTransport = async (email) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: "Email is not configured (RESEND_API_KEY missing)." };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Mix Print Design <onboarding@resend.dev>",
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { sent: false, error: `Email service returned ${response.status}: ${(await response.text()).slice(0, 200)}` };
    return { sent: true };
  } catch (error) {
    return { sent: false, error: `Email could not be sent: ${(error as Error).message}` };
  }
};
