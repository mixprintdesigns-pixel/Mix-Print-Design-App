// What the website shows from the rate data. Hidden sections, groups and buttons, and anything with a rate
// of 0, are left out.
//
// A section (blue title bar) has groups:
// - FLEX: rows of buttons. The first row sits under the title bar; each further row has its own bar with its
//   name (e.g. "Most Famous Flex Names").
// - STICKER: one column per sticker type, each with its series buttons.
// - SIGN_BOARD: one card per quality, with one rate (its button), the features checklist and a description.

import type { PricingRule } from "./calculator";

export type RateSectionKind = "FLEX" | "STICKER" | "SIGN_BOARD";

export type RateVariantRow = { id: string; label: string; rateMinor: number; isVisible: boolean; sortOrder: number; rule?: RateSectionKind | null };
export type RateItemRow = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  rateMinor: number;
  isVisible: boolean;
  sortOrder: number;
  featureIds: string[];
  variants: RateVariantRow[];
};
export type RateSectionRow = {
  id: string;
  title: string;
  kind: RateSectionKind;
  isVisible: boolean;
  sortOrder: number;
  items: RateItemRow[];
  fittingRateMinor?: number | null;
  askDesignCode?: boolean;
};
export type RateFeatureRow = { id: string; label: string; isVisible: boolean; sortOrder: number };

/** A rate button. `rule` is set only when this button uses a different pricing rule from its section. */
export type PublicButton = { id: string; label: string; rateMinor: number; rule?: PricingRule };
export type PublicGroup = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  buttons: PublicButton[];
  /** Sign boards: the full features list, ticked where this quality includes it. */
  features: { label: string; included: boolean }[];
};
export type PublicSection = {
  id: string;
  title: string;
  kind: RateSectionKind;
  groups: PublicGroup[];
  /** 3D Wallpaper: fitting charges per sq ft (the calculator shows a Fitting box with "Include fitting"). */
  fittingRateMinor: number | null;
  askDesignCode: boolean;
};

/** The pricing rule a section uses. */
export const ruleFor = (kind: RateSectionKind): PricingRule => kind;
/** The rule a button uses: its own, or its section's. */
export const buttonRule = (section: Pick<PublicSection, "kind">, button: PublicButton): PricingRule => button.rule ?? ruleFor(section.kind);

const byOrder = <T extends { sortOrder: number }>(rows: T[]) => [...rows].sort((a, b) => a.sortOrder - b.sortOrder);

export function publicButtons(variants: RateVariantRow[]): PublicButton[] {
  return byOrder(variants.filter((v) => v.isVisible && v.rateMinor > 0)).map(({ id, label, rateMinor, rule }) => ({ id, label, rateMinor, ...(rule ? { rule } : {}) }));
}

/** A group as shown, or null when it is hidden or has nothing with a rate. */
export function publicGroup(kind: RateSectionKind, item: RateItemRow, features: RateFeatureRow[] = []): PublicGroup | null {
  if (!item.isVisible) return null;
  const base = { id: item.id, name: item.name, subtitle: item.subtitle, description: item.description, imageUrl: item.imageUrl, imageAlt: item.imageAlt };
  if (kind === "SIGN_BOARD") {
    if (!(item.rateMinor > 0)) return null;
    const list = byOrder(features.filter((f) => f.isVisible)).map((f) => ({ label: f.label, included: item.featureIds.includes(f.id) }));
    return { ...base, buttons: [{ id: item.id, label: item.subtitle || item.name, rateMinor: item.rateMinor }], features: list };
  }
  const buttons = publicButtons(item.variants);
  return buttons.length > 0 ? { ...base, buttons, features: [] } : null;
}

export function publicSection(section: RateSectionRow, features: RateFeatureRow[] = []): PublicSection | null {
  if (!section.isVisible) return null;
  const groups = byOrder(section.items)
    .map((i) => publicGroup(section.kind, i, features))
    .filter((g): g is PublicGroup => g !== null);
  return groups.length > 0
    ? { id: section.id, title: section.title, kind: section.kind, groups, fittingRateMinor: section.fittingRateMinor ?? null, askDesignCode: section.askDesignCode ?? false }
    : null;
}

export function publicSections(sections: RateSectionRow[], features: RateFeatureRow[] = []): PublicSection[] {
  return byOrder(sections)
    .map((s) => publicSection(s, features))
    .filter((s): s is PublicSection => s !== null);
}

/** The lowest rate per sq ft on offer (for "from" prices and structured data). */
export function lowestRate(sections: PublicSection[]): number {
  return Math.min(...sections.flatMap((s) => s.groups.flatMap((g) => g.buttons.map((b) => b.rateMinor))));
}

/** The order line name for a button: "Flex 240 GSM", "China Flex 240 GSM", "Vinyl Sticker 2000 series", or the quality's name. */
export function buttonName(section: Pick<PublicSection, "kind" | "groups">, group: PublicGroup, button: PublicButton): string {
  if (section.kind === "SIGN_BOARD") return group.name;
  const isNamedRow = section.kind === "FLEX" && section.groups.indexOf(group) > 0;
  return isNamedRow || button.label.toLowerCase().startsWith(group.name.toLowerCase()) ? button.label : `${group.name} ${button.label}`;
}

// ─── Which button fits a page best (China Flex page → "China Flex 240 GSM") ────

const words = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

/** How well a button matches a page name: shared words, plus a bonus when the button starts like the page name. */
export function matchScore(pageName: string, label: string, groupName = ""): number {
  const page = words(pageName);
  if (page.length === 0) return 0;
  const text = new Set(words(`${label} ${groupName}`));
  const shared = page.filter((w) => text.has(w)).length;
  const startsLike = words(label)[0] === page[0] ? 2 : 0;
  return shared + startsLike;
}

/** The button to pre-select for a page (by its name), or null when nothing clearly matches. */
export function preselectFor(section: PublicSection, pageName: string): { groupId: string; buttonId: string } | null {
  let best: { groupId: string; buttonId: string; score: number } | null = null;
  for (const g of section.groups) {
    for (const b of g.buttons) {
      const score = matchScore(pageName, b.label, section.kind === "FLEX" ? "" : g.name);
      if (score >= 3 && (!best || score > best.score)) best = { groupId: g.id, buttonId: b.id, score };
    }
  }
  return best && { groupId: best.groupId, buttonId: best.buttonId };
}
