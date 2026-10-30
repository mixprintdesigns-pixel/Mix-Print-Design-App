// Shared helpers for the Design work, Customers, Payments and Reports admin sections.

export const TIME_ZONE = "Asia/Karachi";

/** Orders with these statuses are not counted as sales or as money owed. */
export const NOT_SALES_STATUSES = ["CANCELLED", "REFUNDED"] as const;

export function formatKarachiDate(date: Date, withTime = false): string {
  return date.toLocaleString("en-PK", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/** Today's date in Pakistan as YYYY-MM-DD, for date inputs. */
export function karachiToday(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

/** "2026-10-30" entered in Pakistan → that day at noon Pakistan time (UTC+5), so it never shifts a day. */
export function karachiDateToUtc(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00+05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}
