import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";
import { getCurrentUser, safeNextPath } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create account" };

export default function Page({ searchParams }: PageProps<"/register">) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-center text-3xl font-bold">Create your MixPrint account</h1>
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
