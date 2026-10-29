import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { JoinForm } from "@/components/affiliate/join-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getAffiliateForUser, getUserPhone } from "@/lib/affiliate/service";

export const metadata: Metadata = { title: "Join the affiliate program", robots: { index: false } };

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Join the MixPrint affiliate program</h1>
      <p className="mt-2 text-muted">Tell us where to send your earnings and how you plan to share MixPrint.</p>
      <div className="card mt-8 p-6">
        <Suspense fallback={<div className="h-96 animate-pulse" />}>
          <Join />
        </Suspense>
      </div>
    </div>
  );
}

async function Join() {
  const user = await getCurrentUser();
  if (!user) {
    // New visitors create their account here; it is activated only after email + SMS verification.
    return (
      <>
        <p className="mb-5 text-sm text-muted">
          Already have a Mix Print account?{" "}
          <Link href="/login?next=/affiliate/join" className="font-semibold text-brand">
            Sign in first
          </Link>
          .
        </p>
        <JoinForm phone={null} name="" reapplying={false} newAccount />
      </>
    );
  }
  const affiliate = await getAffiliateForUser(user.id);
  if (affiliate && affiliate.status !== "REJECTED") redirect("/affiliate/dashboard");
  return (
    <>
      {affiliate?.status === "REJECTED" && (
        <p className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Your previous application was not approved{affiliate.adminNote ? `: ${affiliate.adminNote}` : "."} You can apply again.
        </p>
      )}
      <JoinForm phone={await getUserPhone(user.id)} name={user.name} reapplying={affiliate?.status === "REJECTED"} />
    </>
  );
}
