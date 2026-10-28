import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import { getCurrentUser, safeNextPath } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default function Page({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-center text-3xl font-bold">Welcome back</h1>
      <div className="card mt-8 p-6">
        <Suspense fallback={<div className="h-72 animate-pulse" />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeNextPath(next) : undefined;
  if (await getCurrentUser()) redirect(nextPath ?? "/account");
  return <LoginForm next={nextPath} />;
}
