import { saveAffiliateSettingsAction } from "@/app/admin/affiliate-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AffiliateTabs } from "@/components/admin/affiliate-tabs";
import { requireStaff } from "@/lib/auth/session";
import { getAffiliateSettings } from "@/lib/affiliate/service";

export const metadata = { title: "Affiliate settings" };

export default async function AffiliateSettingsPage() {
  await requireStaff(["ADMIN"]);
  const s = await getAffiliateSettings();
  const fields: [name: string, label: string, value: number, hint: string][] = [
    ["defaultRate", "Default commission %", s.defaultRateBps / 100, "Used when neither the product nor the affiliate has its own rate."],
    ["cookieDays", "Referral window (days)", s.cookieDays, "How long after a click an order still counts for the affiliate."],
    ["holdDays", "Hold period after delivery (days)", s.holdDays, "Commission is approved after this many days, covering returns and refunds."],
    ["minWithdrawal", "Minimum withdrawal (PKR)", s.minWithdrawalMinor / 100, "Smallest balance an affiliate can withdraw."],
  ];
  return (
    <>
      <h1 className="text-2xl font-bold">Affiliates & commissions</h1>
      <AffiliateTabs current="/admin/affiliates/settings" />
      <ActionForm action={saveAffiliateSettingsAction} className="card mt-6 max-w-2xl space-y-4 p-6">
        {fields.map(([name, label, value, hint]) => (
          <div key={name}>
            <label htmlFor={name} className="label">
              {label}
            </label>
            <input id={name} name={name} type="number" step="any" min={0} defaultValue={value} className="input max-w-40" aria-describedby={`${name}-hint`} />
            <p id={`${name}-hint`} className="mt-1 text-xs text-muted">
              {hint}
            </p>
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="autoApprove" defaultChecked={s.autoApprove} />
          Approve new affiliates automatically (no review)
        </label>
        <SubmitButton className="btn-primary">Save settings</SubmitButton>
      </ActionForm>
    </>
  );
}
