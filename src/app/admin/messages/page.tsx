import { setMessageHandledAction } from "@/app/admin/site-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { requireStaff } from "@/lib/auth/session";
import { whatsappLinkTo } from "@/lib/business";
import { listContactMessages } from "@/lib/contact/service";

export const metadata = { title: "Contact messages" };

export default async function AdminMessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  await requireStaff();
  const open = (await searchParams).show !== "all";
  const messages = await listContactMessages({ open });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Contact messages</h1>
        <a href={open ? "/admin/messages?show=all" : "/admin/messages"} className="text-sm font-semibold text-brand">
          {open ? "Show all messages" : "Show open messages only"}
        </a>
      </div>
      <p className="mt-1 text-sm text-muted">Messages from the Contact Us form. Each one is also emailed to the business inbox when email is configured.</p>
      <ul className="mt-6 space-y-4">
        {messages.length === 0 && <li className="card p-8 text-center text-muted">No {open ? "open " : ""}messages.</li>}
        {messages.map((m) => (
          <li key={m.id} className={`card p-5 ${m.handledAt ? "opacity-70" : ""}`} data-testid="contact-message">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {m.name} <span className="font-normal text-muted">· {m.createdAt.toLocaleString("en-PK")}</span>
                </p>
                <p className="text-sm">
                  <a href={`mailto:${m.email}`} className="text-brand">
                    {m.email}
                  </a>
                  {m.phone && (
                    <>
                      {" · "}
                      {whatsappLinkTo(m.phone) ? (
                        <a href={whatsappLinkTo(m.phone)!} target="_blank" rel="noopener noreferrer" className="text-brand">
                          {m.phone} (WhatsApp)
                        </a>
                      ) : (
                        m.phone
                      )}
                    </>
                  )}
                </p>
                {m.subject && <p className="mt-1 text-sm font-medium">{m.subject}</p>}
              </div>
              <div className="text-right text-xs">
                {m.emailSentAt ? (
                  <span className="text-green-700 dark:text-green-400">Emailed</span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400" title={m.emailError ?? undefined}>
                    Not emailed
                  </span>
                )}
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm">{m.message}</p>
            <ActionForm action={setMessageHandledAction} className="mt-3">
              <input type="hidden" name="id" value={m.id} />
              <SubmitButton name="handled" value={m.handledAt ? "0" : "1"}>
                {m.handledAt ? "Mark as open" : "Mark as handled"}
              </SubmitButton>
            </ActionForm>
          </li>
        ))}
      </ul>
    </>
  );
}
