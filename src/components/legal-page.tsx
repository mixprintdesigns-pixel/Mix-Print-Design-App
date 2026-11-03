import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";

/** Layout for the Privacy Policy and Terms pages: one title, a date, and readable sections. */
export function LegalPage({ title, path, updated, children }: { title: string; path: string; updated: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs items={[{ name: title, href: path }]} />
      <h1 className="mt-3 text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated: {updated}</p>
      <div className="mt-8 space-y-8 leading-relaxed text-foreground/90 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_li]:mt-1 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </div>
  );
}

export const CONTACT = { email: "mixprintdesigns@gmail.com", phone: "+92 303 488 9255", tel: "+923034889255", address: "Raiwind Road, Lahore, Pakistan" };
