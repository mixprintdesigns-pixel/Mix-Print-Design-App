"use server";

import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { AdminInputError } from "@/lib/admin/catalog-service";
import { saveRateSettings } from "@/lib/rates/admin";
import { RATES_TAG } from "@/lib/rates/queries";
import type { ActionState } from "./affiliate-actions";

// Calculator settings (designing charges, minimum order), on Admin → Categories & Services. Admins only.
// Sections, buttons and rates are saved with each service's "All settings" page (categories/full-actions.ts).

export async function saveRateSettingsAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  await requireStaff(["ADMIN"]);
  try {
    await saveRateSettings(data);
  } catch (error) {
    if (error instanceof AdminInputError) return { error: error.message };
    throw error;
  }
  updateTag(RATES_TAG);
  refresh();
  return { message: "Calculator settings saved." };
}
