"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { refresh } from "next/cache";
import { authenticate, EmailTakenError, LOCKOUT_MS, registerUser } from "@/lib/auth/service";
import { endSession, safeNextPath, startSession } from "@/lib/auth/session";
import { adoptGuestCart } from "@/lib/cart/session";
import { z } from "zod";
import { loginSchema, registerSchema, type FieldErrors } from "@/lib/validation";

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
