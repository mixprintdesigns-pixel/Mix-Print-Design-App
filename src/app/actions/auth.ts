"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { refresh } from "next/cache";
import { authenticate, EmailTakenError, LOCKOUT_MS, registerUser } from "@/lib/auth/service";
import { endSession, safeNextPath, startSession } from "@/lib/auth/session";
import { adoptGuestCart } from "@/lib/cart/session";
import { z } from "zod";
import { loginSchema, registerSchema, type FieldErrors } from "@/lib/validation";
import { requestPasswordReset, resetPassword, ResetError } from "@/lib/auth/password-reset";

export type AuthFormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
};

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { name: raw.name, email: raw.email, phone: raw.phone };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  let userId: string;
  try {
    userId = (await registerUser(parsed.data)).id;
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return { fieldErrors: { email: ["An account with this email already exists. Try signing in."] }, values };
    }
    throw error;
  }

  await startSession(userId);
  await adoptGuestCart(userId);
  redirect(safeNextPath(formData.get("next")));
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return {
      error:
        result.reason === "locked"
          ? `Too many failed attempts. Please try again in ${LOCKOUT_MS / 60000} minutes.`
          : "Incorrect email or password.",
      values,
    };
  }

  await startSession(result.user.id);
  await adoptGuestCart(result.user.id);
  // Affiliates land on their dashboard unless the sign-in asked to return somewhere specific.
  const next = formData.get("next");
  if (!next && (await prisma.affiliate.findUnique({ where: { userId: result.user.id }, select: { id: true } }))) {
    redirect("/affiliate/dashboard");
  }
  redirect(safeNextPath(next));
}

export async function logoutAction(): Promise<void> {
  await endSession();
  refresh();
  redirect("/");
}

export type ResetFormState = AuthFormState & { step?: "code"; email?: string };

const resetEmailSchema = loginSchema.pick({ email: true });

/** Step 1 of "Forgot password": email a code. Always moves on to step 2, whether or not the account exists. */
export async function requestResetAction(_prev: ResetFormState, formData: FormData): Promise<ResetFormState> {
  const parsed = resetEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: { email: String(formData.get("email") ?? "") } };
  }
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  try {
    await requestPasswordReset(parsed.data.email, { ip });
  } catch (error) {
    if (error instanceof ResetError) return { error: error.message, values: { email: parsed.data.email } };
    throw error;
  }
  return { step: "code", email: parsed.data.email };
}

/** Step 2: check the code and save the new password, then sign in. */
export async function resetPasswordAction(_prev: ResetFormState, formData: FormData): Promise<ResetFormState> {
  const email = resetEmailSchema.safeParse({ email: formData.get("email") });
  if (!email.success) return { error: "Please start again and enter your email." };
  const keep = { step: "code" as const, email: email.data.email };

  const code = String(formData.get("code") ?? "").trim();
  const password = registerSchema.shape.password.safeParse(String(formData.get("password") ?? ""));
  const fieldErrors: FieldErrors = {};
  if (!/^\d{6}$/.test(code)) fieldErrors.code = ["Enter the 6-digit code from the email."];
  if (!password.success) fieldErrors.password = [password.error.issues[0].message];
  else if (formData.get("confirm") !== password.data) fieldErrors.confirm = ["The two passwords do not match."];
  if (Object.keys(fieldErrors).length) return { ...keep, fieldErrors };

  let result;
  try {
    result = await resetPassword(email.data.email, code, password.data!);
  } catch (error) {
    if (error instanceof ResetError) return { ...keep, error: error.message };
    throw error;
  }
  if (!result.ok) return { ...keep, error: result.message };

  await startSession(result.userId);
  redirect(result.role === "ADMIN" || result.role === "STAFF" ? "/admin" : "/account");
}
