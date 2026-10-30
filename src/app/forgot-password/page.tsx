import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function Page() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="flex justify-center">
        <BrandLogo className="h-14 w-auto" priority />
      </div>
      <h1 className="mt-4 text-center text-3xl font-bold">Reset your password</h1>
      <div className="card mt-8 p-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
