"use client";

import { useState, type ReactNode } from "react";
import { buttonName, buttonRule, ruleFor, type PublicButton, type PublicGroup, type PublicSection } from "@/lib/rates/visibility";
import type { RateSettingsData } from "@/lib/rates/queries";
import { ButtonRow, CalculatorRow, RateBar, RateButton, type Selection } from "./rate-calculator";

type Settings = RateSettingsData;
type Preselect = { groupId: string; buttonId: string } | undefined;

const select = (section: PublicSection, group: PublicGroup, b: PublicButton): Selection => ({
  itemId: group.id,
  variantId: b.id,
  button: b,
  name: buttonName(section, group, b),
  rule: buttonRule(section, b),
});

/** The pre-selected button of a page (e.g. China Flex 240 GSM on the China Flex page), as a selection. */
function initial(section: PublicSection, pre: Preselect): Selection {
  const group = pre && section.groups.find((g) => g.id === pre.groupId);
  const button = group?.buttons.find((b) => b.id === pre!.buttonId);
  return group && button ? select(section, group, button) : null;
}

/** Flex / Backlit Flex: the title bar, the GSM buttons, further named rows (e.g. Most Famous Flex Names), one calculator. */
export function FlexSection({ section, settings, preselect }: { section: PublicSection; settings: Settings; preselect?: Preselect }) {
  const [selection, setSelection] = useState<Selection>(() => initial(section, preselect));
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
                onSelect={() => setSelection(select(section, group, b))}
              />
            ))}
          </ButtonRow>
        </div>
      ))}
      <CalculatorRow
        rule={ruleFor(section.kind)}
        selection={selection}
        designChargeMinor={settings.designChargeMinor}
        minOrderMinor={settings.minOrderMinor}
        fittingRateMinor={section.fittingRateMinor}
        askDesignCode={section.askDesignCode}
      />
    </section>
  );
}

/** Stickers: the title bar, one column per sticker type with its series buttons, one calculator. */
export function StickerSection({ section, settings, preselect }: { section: PublicSection; settings: Settings; preselect?: Preselect }) {
  const [selection, setSelection] = useState<Selection>(() => initial(section, preselect));
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
                  onSelect={() => setSelection(select(section, group, b))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <CalculatorRow
        rule={ruleFor(section.kind)}
        selection={selection}
        designChargeMinor={settings.designChargeMinor}
        minOrderMinor={settings.minOrderMinor}
        fittingRateMinor={section.fittingRateMinor}
        askDesignCode={section.askDesignCode}
      />
    </section>
  );
}

/** One sign board quality: its rate button, then (children) the features and description, then its own calculator. */
export function SignBoardQuality({
  section,
  groupId,
  settings,
  preselected = false,
  children,
}: {
  section: PublicSection;
  groupId: string;
  settings: Settings;
  preselected?: boolean;
  children: ReactNode;
}) {
  const group = section.groups.find((g) => g.id === groupId)!;
  const button = group.buttons[0];
  const [selected, setSelected] = useState(preselected);
  const own: Selection = { itemId: group.id, variantId: null, button, name: group.name, rule: buttonRule(section, button) };
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
