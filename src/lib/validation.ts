import { z } from "zod";

/** Normalises Pakistani mobile numbers (03xx…, 923xx…, +923xx…) to E.164. */
export function normalizePakistaniMobile(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  const match = /^(?:\+92|0092|92|0)(3\d{9})$/.exec(digits);
  return match ? `+92${match[1]}` : null;
}

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254));

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100),
  email,
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const normalized = normalizePakistaniMobile(v);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 0300 1234567." });
        return z.NEVER;
      }
      return normalized;
    }),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters.")
    .max(128, "Password must be at most 128 characters.")
    .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Password must contain letters and numbers."),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const addToCartSchema = z.object({
  productId: z.string().min(1).max(50),
  quantity: z.coerce.number().int(),
  optionValueIds: z.array(z.string().min(1).max(50)).max(20),
  notes: z.string().trim().max(500).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type FieldErrors = Partial<Record<string, string[]>>;
