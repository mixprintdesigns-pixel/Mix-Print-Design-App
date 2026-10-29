import { readFileSync } from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";

const FILE = path.join(process.cwd(), "storage", "dev-outbox.jsonl");

/** Latest 6-digit code sent to `to` on a channel (from the server's local test outbox). */
export async function latestCode(channel: "email" | "sms", to: string, after?: string): Promise<string> {
  let code = "";
  await expect
    .poll(() => {
      let lines: string[] = [];
      try {
        lines = readFileSync(FILE, "utf8").trim().split("\n");
      } catch {}
      const match = lines
        .map((l) => JSON.parse(l) as { channel: string; to: string; body: string })
        .filter((m) => m.channel === channel && m.to === to)
        .at(-1)
        ?.body.match(/\b(\d{6})\b/);
      code = match?.[1] ?? "";
      return code !== "" && code !== after;
    })
    .toBe(true);
  return code;
}

/** A random, valid Pakistani mobile number so test accounts never collide. */
export function randomMobile(): { local: string; e164: string } {
  const digits = String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
  return { local: `03${digits}`, e164: `+923${digits}` };
}
