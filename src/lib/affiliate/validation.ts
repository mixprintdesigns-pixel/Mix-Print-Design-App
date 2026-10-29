import { z } from "zod";
import { normalizePakistaniMobile } from "@/lib/validation";

export const PAYOUT_METHODS = ["JAZZCASH", "EASYPAISA", "BANK_TRANSFER"] as const;
export type PayoutMethodValue = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_LABEL: Record<PayoutMethodValue, string> = {
  JAZZCASH: "JazzCash wallet",
  EASYPAISA: "Easypaisa wallet",
  BANK_TRANSFER: "Bank account (IBAN)",
};

/** Pakistani IBAN: PK + 2 check digits + 4-letter bank code + 16 digits. */
export function normalizeIban(input: string): string | null {
  const iban = input.replace(/\s+/g, "").toUpperCase();
  return /^PK\d{2}[A-Z]{4}\d{16}$/.test(iban) ? iban : null;
}

export const payoutDetailsSchema = z
  .object({
    payoutMethod: z.enum(PAYOUT_METHODS, { message: "Choose how you want to be paid." }),
    payoutAccount: z.string().trim().min(1, "Enter your account number."),
    payoutAccountName: z.string().trim().min(2, "Enter the account title (name on the account).").max(100),
  })
  .transform((v, ctx) => {
    const account =
      v.payoutMethod === "BANK_TRANSFER" ? normalizeIban(v.payoutAccount) : normalizePakistaniMobile(v.payoutAccount);
    if (!account) {
      ctx.addIssue({
        code: "custom",
        path: ["payoutAccount"],
        message:
          v.payoutMethod === "BANK_TRANSFER"
            ? "Enter a valid Pakistani IBAN, e.g. PK36SCBL0000001123456702."
            : "Enter the wallet's mobile number, e.g. 0300 1234567.",
      });
      return z.NEVER;
    }
    return { ...v, payoutAccount: account };
  });

export const applicationSchema = z.object({
  website: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
  promotionPlan: z
    .string()
    .trim()
    .min(10, "Tell us briefly how you will promote MixPrint (at least 10 characters).")
    .max(1000),
  agreeTerms: z.literal("on", { message: "You must accept the affiliate terms." }),
});

export const settingsSchema = z.object({
  defaultRate: z.coerce.number().min(0, "Rate must be 0–50%.").max(50, "Rate must be 0–50%."),
  cookieDays: z.coerce.number().int().min(1, "Between 1 and 365 days.").max(365, "Between 1 and 365 days."),
  minWithdrawal: z.coerce.number().min(0).max(1_000_000),
  holdDays: z.coerce.number().int().min(0).max(120),
  autoApprove: z.boolean(),
});
