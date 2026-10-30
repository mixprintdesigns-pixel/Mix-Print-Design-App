import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { RegisterForm } from "@/components/auth-forms";
import { getCurrentUser, safeNextPath } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function Page({ searchParams }: PageProps<"/register">) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="flex justify-center">
        <BrandLogo className="h-14 w-auto" priority />
      </div>
      <h1 className="mt-4 text-center text-3xl font-bold">Create your Mix Print Design account</h1>
      <div className="card mt-8 p-6">
        <Suspense fallback={<div className="h-72 animate-pulse" />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/register">["searchParams"] }) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeNextPath(next) : undefined;
  if (await getCurrentUser()) redirect(nextPath ?? "/account");
  return <RegisterForm next={nextPath} />;
}
