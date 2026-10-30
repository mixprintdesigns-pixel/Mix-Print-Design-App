"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { AFFILIATE_SETTINGS_TAG } from "@/lib/affiliate/public";
import {
  AffiliateError,
  approveCommission,
  approveDueCommissions,
  markWithdrawalPaid,
  rejectWithdrawal,
  reverseCommission,
  setAffiliateRate,
  setAffiliateStatus,
  updateAffiliateSettings,
} from "@/lib/affiliate/service";
import { settingsSchema } from "@/lib/affiliate/validation";
import { parsePercent } from "@/lib/admin/product-input";

export type ActionState = { error?: string; message?: string };

const id = z.string().min(1).max(50);
const text = (data: FormData, key: string) => String(data.get(key) ?? "");

/** Runs an admin-only change and turns rule violations into a message for the form. */
async function adminOnly(fn: () => Promise<string>): Promise<ActionState> {
  await requireStaff(["ADMIN"]);
  try {
    const message = await fn();
    refresh();
    return { message };
  } catch (error) {
    if (error instanceof AffiliateError) return { error: error.message };
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Invalid input." };
    throw error;
  }
}

export async function setAffiliateStatusAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return adminOnly(async () => {
    const status = z.enum(["APPROVED", "REJECTED", "SUSPENDED"]).parse(data.get("status"));
    const note = text(data, "note").trim();
    if (status !== "APPROVED" && note.length < 3) throw new AffiliateError("Add a short reason the affiliate will see.");
    await setAffiliateStatus(id.parse(data.get("affiliateId")), status, note);
    return { APPROVED: "Affiliate approved.", REJECTED: "Application rejected.", SUSPENDED: "Affiliate suspended." }[status];
  });
}

export async function setAffiliateRateAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return adminOnly(async () => {
    const raw = text(data, "rate").trim();
    const bps = raw === "" ? null : parsePercent(raw);
    if (raw !== "" && bps === null) throw new AffiliateError("Enter a percentage such as 7.5, or leave empty for the default.");
    await setAffiliateRate(id.parse(data.get("affiliateId")), bps);
    return bps === null ? "Using the program default rate." : "Custom rate saved.";
  });
}

export async function approveCommissionAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return adminOnly(async () => {
    await approveCommission(id.parse(data.get("commissionId")));
    return "Commission approved.";
  });
}

export async function reverseCommissionAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return adminOnly(async () => {
    const note = text(data, "note").trim();
    if (note.length < 3) throw new AffiliateError("Add a reason for reversing this commission.");
    await reverseCommission(id.parse(data.get("commissionId")), note.slice(0, 300));
    return "Commission reversed.";
  });
}

export async function approveDueCommissionsAction(_prev: ActionState): Promise<ActionState> {
  return adminOnly(async () => {
    const count = await approveDueCommissions();
    return count === 0 ? "No commissions are due yet." : `${count} commission${count > 1 ? "s" : ""} approved.`;
  });
}

export async function markWithdrawalPaidAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return adminOnly(async () => {
    const paidAt = text(data, "paidAt");
    const method = z.enum(["JAZZCASH", "EASYPAISA", "BANK_TRANSFER"]).optional().parse(text(data, "paidMethod") || undefined);
    await markWithdrawalPaid(id.parse(data.get("withdrawalId")), text(data, "transactionRef"), {
      paidAt: paidAt ? new Date(`${paidAt}T12:00:00+05:00`) : undefined,
      method,
    });
    return "Marked as paid.";
  });
}

export async function rejectWithdrawalAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return adminOnly(async () => {
    await rejectWithdrawal(id.parse(data.get("withdrawalId")), text(data, "adminNote"));
    return "Withdrawal rejected; the balance was returned to the affiliate.";
  });
}

export async function saveAffiliateSettingsAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return adminOnly(async () => {
    const s = settingsSchema.parse({
      defaultRate: data.get("defaultRate"),
      cookieDays: data.get("cookieDays"),
      minWithdrawal: data.get("minWithdrawal"),
      holdDays: data.get("holdDays"),
      autoApprove: data.get("autoApprove") === "on",
    });
    await updateAffiliateSettings({
      defaultRateBps: Math.round(s.defaultRate * 100),
      cookieDays: s.cookieDays,
      minWithdrawalMinor: Math.round(s.minWithdrawal * 100),
      holdDays: s.holdDays,
      autoApprove: s.autoApprove,
    });
    updateTag(AFFILIATE_SETTINGS_TAG);
    return "Program settings saved.";
  });
}
