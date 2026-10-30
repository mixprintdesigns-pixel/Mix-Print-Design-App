"use server";

import { DesignWorkError, respondToProof } from "@/lib/admin-sections/design-work";

export type ApprovalState = { error?: string; done?: "APPROVED" | "CHANGES_REQUESTED" };

/** The customer's answer on their design approval link. The link's token is the permission. */
export async function respondToProofAction(_prev: ApprovalState, data: FormData): Promise<ApprovalState> {
  const token = String(data.get("token") ?? "");
  const proofId = String(data.get("proofId") ?? "");
  const decision = data.get("decision") === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED";
  try {
    await respondToProof(token, proofId, decision, String(data.get("comment") ?? ""));
  } catch (error) {
    if (error instanceof DesignWorkError) return { error: error.message };
    throw error;
  }
  // No page refresh: the form shows the thank-you message, and a reload shows the saved answer.
  return { done: decision };
}
