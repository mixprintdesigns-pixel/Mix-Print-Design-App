import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

// Old links to a rate page open the rates of its service in Admin → Categories & Services.
export default async function AdminRatePage({ params }: PageProps<"/admin/rates/[id]">) {
  await requireStaff(["ADMIN"]);
  const page = await prisma.ratePage.findUnique({ where: { id: (await params).id }, select: { categoryId: true } });
  redirect(page?.categoryId ? `/admin/categories/${page.categoryId}#rates` : "/admin/categories");
}
