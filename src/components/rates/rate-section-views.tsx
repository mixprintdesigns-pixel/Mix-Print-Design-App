"use client";

import { useState, type ReactNode } from "react";
import { buttonName, ruleFor, type PublicSection } from "@/lib/rates/visibility";
import type { RateSettingsData } from "@/lib/rates/queries";
import { ButtonRow, CalculatorRow, RateBar, RateButton, type Selection } from "./rate-calculator";

type Settings = RateSettingsData;

/** Flex / Backlit Flex: the title bar, the GSM buttons, further named rows (e.g. Most Famous Flex Names), one calculator. */
export function FlexSection({ section, settings }: { section: PublicSection; settings: Settings }) {
  const [selection, setSelection] = useState<Selection>(null);
  return (
    <section aria-labelledby={`sec-${section.id}`} className="space-y-3" data-testid="rate-section">
      <RateBar id={`sec-${section.id}`}>{section.title}</RateBar>
      {section.groups.map((group, i) => (
        <div key={group.id} className="space-y-3">
          {i > 0 && (
            <RateBar as="h3" small>
              {group.name}
            </RateBar>
          )}
          <ButtonRow label={i > 0 ? group.name : section.title}>
            {group.buttons.map((b) => (
              <RateButton
                key={b.id}
                button={b}
                wide={i > 0}
                selected={selection?.button.id === b.id}
                onSelect={() => setSelection({ itemId: group.id, variantId: b.id, button: b, name: buttonName(section, group, b) })}
              />
            ))}
          </ButtonRow>
        </div>
      ))}
      <CalculatorRow rule={ruleFor(section.kind)} selection={selection} designChargeMinor={settings.designChargeMinor} minOrderMinor={settings.minOrderMinor} />
    </section>
  );
}

/** Stickers: the title bar, one column per sticker type with its series buttons, one calculator. */
export function StickerSection({ section, settings }: { section: PublicSection; settings: Settings }) {
  const [selection, setSelection] = useState<Selection>(null);
  return (
    <section aria-labelledby={`sec-${section.id}`} className="space-y-3" data-testid="rate-section">
      <RateBar id={`sec-${section.id}`}>{section.title}</RateBar>
      <div className="app-scroll-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] sm:overflow-visible sm:px-0">
        {section.groups.map((group) => (
          <div key={group.id} className="w-44 shrink-0 rounded-xl border border-sky-200 bg-surface p-2 sm:w-auto dark:border-sky-900" role="group" aria-label={group.name}>
            <h3 className="rounded-md bg-sky-100 px-2 py-1.5 text-center text-sm font-bold text-sky-900 dark:bg-sky-950 dark:text-sky-100">{group.name}</h3>
            <div className="mt-2 grid gap-2">
              {group.buttons.map((b) => (
                <RateButton
                  key={b.id}
                  button={b}
                  selected={selection?.button.id === b.id}
                  onSelect={() => setSelection({ itemId: group.id, variantId: b.id, button: b, name: buttonName(section, group, b) })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <CalculatorRow rule={ruleFor(section.kind)} selection={selection} designChargeMinor={settings.designChargeMinor} minOrderMinor={settings.minOrderMinor} />
    </section>
  );
}

/** One sign board quality: its rate button, then (children) the features and description, then its own calculator. */
export function SignBoardQuality({ section, groupId, settings, children }: { section: PublicSection; groupId: string; settings: Settings; children: ReactNode }) {
  const group = section.groups.find((g) => g.id === groupId)!;
  const button = group.buttons[0];
  const [selected, setSelected] = useState(false);
  const own: Selection = { itemId: group.id, variantId: null, button, name: group.name };
  const selection: Selection = selected ? own : null;
  return (
    <>
      <ButtonRow label={`${group.name} rate`}>
        <RateButton button={button} selected={selected} wide onSelect={() => setSelected(true)} />
      </ButtonRow>
      {children}
      <CalculatorRow
        rule={ruleFor(section.kind)}
        selection={selection}
        designChargeMinor={settings.designChargeMinor}
        minOrderMinor={settings.minOrderMinor}
        onAutoSelect={() => {
          setSelected(true);
          return own;
        }}
      />
    </>
  );
}
