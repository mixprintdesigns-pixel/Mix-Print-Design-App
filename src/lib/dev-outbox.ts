import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Local testing only: when OTP_DEV_OUTBOX=true and no real provider is configured, verification
// messages are written to ./storage/dev-outbox.jsonl instead of being sent. Never enable in production.

export const DEV_OUTBOX_FILE = path.join(process.cwd(), "storage", "dev-outbox.jsonl");

export function devOutboxEnabled(): boolean {
  return process.env.OTP_DEV_OUTBOX === "true" && process.env.VERCEL_ENV !== "production";
}

export async function writeDevOutbox(entry: { channel: "email" | "sms"; to: string; body: string }): Promise<void> {
  await mkdir(path.dirname(DEV_OUTBOX_FILE), { recursive: true });
  await appendFile(DEV_OUTBOX_FILE, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`);
}
