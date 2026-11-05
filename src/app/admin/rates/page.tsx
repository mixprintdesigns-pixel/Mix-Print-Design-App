import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";

// Rates now live inside Admin → Categories & Services (All settings of each service).
export default async function AdminRatesPage() {
  await requireStaff(["ADMIN"]);
  redirect("/admin/categories");
}
