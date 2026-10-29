"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { AffiliateError, applyAsAffiliate, requestWithdrawal, updatePayoutDetails } from "@/lib/affiliate/service";
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

export async function applyAction(_prev: AffiliateFormState, data: FormData): Promise<AffiliateFormState> {
  const user = await requireUser("/affiliate/join");
  const payout = payoutDetailsSchema.safeParse(payoutFields(data));
  const application = applicationSchema.safeParse({
    website: String(data.get("website") ?? ""),
    promotionPlan: String(data.get("promotionPlan") ?? ""),
    agreeTerms: data.get("agreeTerms"),
  });
  if (!payout.success || !application.success) {
    return { errors: { ...(payout.error ? errorsFrom(payout.error) : {}), ...(application.error ? errorsFrom(application.error) : {}) } };
  }
  try {
    await applyAsAffiliate(user.id, { ...payout.data, website: application.data.website, promotionPlan: application.data.promotionPlan });
  } catch (error) {
    if (error instanceof AffiliateError) return { errors: { [error.field]: error.message } };
    throw error;
  }
  redirect("/affiliate/dashboard?joined=1");
}

export async function updatePayoutAction(_prev: AffiliateFormState, data: FormData): Promise<AffiliateFormState> {
  const user = await requireUser("/affiliate/dashboard");
  const parsed = payoutDetailsSchema.safeParse(payoutFields(data));
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
