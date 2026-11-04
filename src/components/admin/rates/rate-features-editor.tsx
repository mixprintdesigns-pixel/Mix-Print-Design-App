"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { saveRateFeaturesAction } from "@/app/admin/rates-actions";

/** The one master features list shown under every sign board quality (ticked per quality on its own form). */
export function RateFeaturesEditor({ features }: { features: { id: string; label: string; isVisible: boolean; sortOrder: number }[] }) {
  const [extra, setExtra] = useState(1);
  return (
    <ActionForm action={saveRateFeaturesAction} className="mt-4 space-y-3">
      <input type="hidden" name="f_count" value={features.length} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-1 pr-2">Feature</th>
              <th className="py-1 pr-2">Order</th>
              <th className="py-1 pr-2">Show</th>
              <th className="py-1">Delete</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f, i) => (
              <tr key={f.id}>
                <td className="py-1 pr-2">
                  <input type="hidden" name={`f_id_${i}`} value={f.id} />
                  <input name={`f_label_${i}`} className="input" defaultValue={f.label} maxLength={80} aria-label={`Feature ${i + 1}`} />
                </td>
                <td className="py-1 pr-2">
                  <input name={`f_order_${i}`} type="number" className="input w-20" defaultValue={f.sortOrder} aria-label={`Feature ${i + 1} order`} />
                </td>
                <td className="py-1 pr-2 text-center">
                  <input type="checkbox" name={`f_on_${i}`} defaultChecked={f.isVisible} aria-label={`Show feature ${i + 1}`} />
                </td>
                <td className="py-1 text-center">
                  <input type="checkbox" name={`f_del_${i}`} aria-label={`Delete feature ${i + 1}`} />
                </td>
              </tr>
            ))}
            {Array.from({ length: extra }, (_, i) => (
              <tr key={`new-${i}`}>
                <td className="py-1 pr-2" colSpan={4}>
                  <input name="f_new" className="input" maxLength={80} placeholder="New feature, e.g. 2-year warranty" aria-label={`New feature ${i + 1}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setExtra((n) => n + 1)}>
          + Another feature
        </button>
        <SubmitButton className="btn-primary">Save features</SubmitButton>
      </div>
    </ActionForm>
  );
}
