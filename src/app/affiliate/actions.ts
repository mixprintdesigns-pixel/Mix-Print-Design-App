"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser, requireUser, startSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { adoptGuestCart } from "@/lib/cart/session";
import { clearSignupCookie, getSignupCookie, setSignupCookie } from "@/lib/affiliate/signup-cookie";
import { outcomeMessage, resendCode, startSignup, VerificationError, verifyCodes } from "@/lib/affiliate/verification";
import { normalizePakistaniMobile, registerSchema } from "@/lib/validation";
import { AffiliateError, requestWithdrawal, updatePayoutDetails } from "@/lib/affiliate/service";
import { applicationSchema, payoutDetailsSchema } from "@/lib/affiliate/validation";

export type AffiliateFormState = { errors?: Record<string, string>; ok?: boolean; message?: string };

function errorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".") || "_form"] ??= issue.message;
  return out;
}

const payoutFields = (data: FormData) => ({
  payoutMethod: data.get("payoutMethod"),
  payoutAccount: String(data.get("payoutAccount") ?? ""),
  payoutAccountName: String(data.get("payoutAccountName") ?? ""),
});

function parseApplication(data: FormData, fallbackAccountName = "") {
  const fields = payoutFields(data);
  // The account title is usually the person's own name; use it when left empty.
  if (!fields.payoutAccountName.trim()) fields.payoutAccountName = fallbackAccountName;
  const payout = payoutDetailsSchema.safeParse(fields);
  const application = applicationSchema.safeParse({
    website: String(data.get("website") ?? ""),
    promotionPlan: String(data.get("promotionPlan") ?? ""),
    agreeTerms: data.get("agreeTerms"),
  });
  const errors = { ...(payout.error ? errorsFrom(payout.error) : {}), ...(application.error ? errorsFrom(application.error) : {}) };
  if (!payout.success || !application.success) return { errors };
  return { application: { ...payout.data, website: application.data.website, promotionPlan: application.data.promotionPlan } };
}

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/**
 * Affiliate signup. Signed-out visitors create a new account; signed-in customers join with theirs.
 * Either way, nothing is activated until the email code and the SMS code are both verified.
 */
export async function applyAction(_prev: AffiliateFormState, data: FormData): Promise<AffiliateFormState> {
  const user = await getCurrentUser();
  const parsed = parseApplication(data, user?.name ?? String(data.get("name") ?? ""));
  const errors: Record<string, string> = { ...(parsed.errors ?? {}) };

  let account: { name: string; email: string; phone: string; passwordHash?: string; userId?: string } | null = null;
  if (user) {
    const phone = normalizePakistaniMobile(String(data.get("phone") ?? ""));
    if (!phone) errors.phone = "Enter your mobile number, e.g. 0300 1234567.";
    else account = { userId: user.id, name: user.name, email: user.email, phone };
  } else {
    const fields = registerSchema.safeParse({
      name: data.get("name") ?? "",
      email: data.get("email") ?? "",
      phone: data.get("phone") ?? "",
      password: data.get("password") ?? "",
    });
    if (!fields.success) Object.assign(errors, errorsFrom(fields.error));
    else if (!fields.data.phone) errors.phone = "Enter your mobile number, e.g. 0300 1234567.";
    else account = { name: fields.data.name, email: fields.data.email, phone: fields.data.phone, passwordHash: await hashPassword(fields.data.password) };
  }
  if (!account || !parsed.application || Object.keys(errors).length > 0) return { errors };

  let result;
  try {
    result = await startSignup({ ...account, application: parsed.application }, { ip: await clientIp() });
  } catch (error) {
    if (error instanceof VerificationError || error instanceof AffiliateError) return { errors: { [error.field]: error.message } };
    throw error;
  }
  if (result.completed) redirect("/affiliate/dashboard?joined=1");
  await setSignupCookie(result.token);
  redirect("/affiliate/verify");
}

export type VerifyState = {
  emailError?: string | null;
  phoneError?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  error?: string;
  message?: string;
};

export async function verifySignupAction(_prev: VerifyState, data: FormData): Promise<VerifyState> {
  const token = await getSignupCookie();
  if (!token) return { error: "This signup has expired. Please fill in the form again." };
  let result;
  try {
    result = await verifyCodes(token, { email: String(data.get("emailCode") ?? ""), phone: String(data.get("phoneCode") ?? "") });
  } catch (error) {
    if (error instanceof VerificationError || error instanceof AffiliateError) return { error: error.message };
    throw error;
  }
  if (!result.done) {
    return {
      emailVerified: result.email === "verified",
      phoneVerified: result.phone === "verified",
      emailError: outcomeMessage(result.email, result.attemptsLeft.email),
      phoneError: outcomeMessage(result.phone, result.attemptsLeft.phone),
    };
  }
  await clearSignupCookie();
  if (result.isNewAccount) {
    await startSession(result.userId);
    await adoptGuestCart(result.userId);
  }
  redirect("/affiliate/dashboard?joined=1");
}

export async function resendSignupCodeAction(_prev: VerifyState, data: FormData): Promise<VerifyState> {
  const token = await getSignupCookie();
  const channel = data.get("channel") === "email" ? "email" : "phone";
  if (!token) return { error: "This signup has expired. Please fill in the form again." };
  try {
    await resendCode(token, channel);
  } catch (error) {
    if (error instanceof VerificationError) return { error: error.message };
    throw error;
  }
  return { message: channel === "email" ? "A new code has been sent to your email." : "A new code has been sent by SMS." };
}

export async function updatePayoutAction(_prev: AffiliateFormState, data: FormData): Promise<AffiliateFormState> {
  const user = await requireUser("/affiliate/dashboard");
  const fields = payoutFields(data);
  if (!fields.payoutAccountName.trim()) fields.payoutAccountName = user.name;
  const parsed = payoutDetailsSchema.safeParse(fields);
  if (!parsed.success) return { errors: errorsFrom(parsed.error) };
  try {
    await updatePayoutDetails(user.id, parsed.data);
  } catch (error) {
    if (error instanceof AffiliateError) return { errors: { [error.field]: error.message } };
    throw error;
  }
  refresh();
  return { ok: true, message: "Payout details saved." };
}

export async function requestWithdrawalAction(_prev: AffiliateFormState): Promise<AffiliateFormState> {
  const user = await requireUser("/affiliate/dashboard");
  try {
    await requestWithdrawal(user.id);
  } catch (error) {
    if (error instanceof AffiliateError) return { errors: { _form: error.message } };
    throw error;
  }
  refresh();
  return { ok: true, message: "Withdrawal requested. We will send the payment and notify you." };
}
