import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { VerifyForm } from "@/components/affiliate/verify-form";
import { getSignupCookie } from "@/lib/affiliate/signup-cookie";
import { getSignupStatus } from "@/lib/affiliate/verification";

export const metadata: Metadata = { title: "Verify your affiliate account", robots: { index: false } };

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-3xl font-bold">Verify your account</h1>
      <p className="mt-2 text-muted">Enter your verification code to activate your Mix Print Design affiliate account.</p>
      <div className="card mt-8 p-6">
        <Suspense fallback={<div className="h-72 animate-pulse" />}>
          <Verify />
        </Suspense>
      </div>
    </div>
  );
}

async function Verify() {
  const status = await getSignupStatus(await getSignupCookie());
  if (!status) {
    return (
      <p>
        This verification link has expired or was already used.{" "}
        <Link href="/affiliate/join" className="font-semibold text-brand">
          Sign up again
        </Link>
      </p>
    );
  }
  return <VerifyForm status={status} />;
}
