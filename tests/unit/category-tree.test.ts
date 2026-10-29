import { describe, expect, it } from "vitest";
import {
  ancestry,
  buildTree,
  categoryUrl,
  defaultCategoryTitle,
  descendantIds,
  findByPath,
  metaDescription,
  productUrl,
  serviceUrl,
  siblings,
  type CategoryRow,
} from "@/lib/catalog/tree";

const row = (id: string, slug: string, parentId: string | null, extra: Partial<CategoryRow> = {}): CategoryRow => ({
  id,
  name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  slug,
  description: null,
  content: null,
  imageUrl: null,
  imageAlt: null,
  sortOrder: 0,
  isVisible: true,
  priceFromMinor: null,
  priceUnit: null,
  seoTitle: null,
  seoDescription: null,
  parentId,
  directProductCount: 0,
  ...extra,
});

const rows = [
  row("offset", "offset-printing", null, { sortOrder: 2 }),
  row("board", "board-maker", null, { sortOrder: 1 }),
  row("cards", "business-cards", "offset", { directProductCount: 1 }),
  row("matte", "matte", "cards", { directProductCount: 2 }),
  row("foil", "foil", "cards", { directProductCount: 4, isVisible: false }),
  row("3d", "3d-sign-board", "board"),
  row("ss", "ss-stainless-steel-sign", "3d", { directProductCount: 1 }),
];

describe("category tree", () => {
  const tree = buildTree(rows);

  it("orders main services and builds slug paths", () => {
    expect(tree.map((n) => n.slug)).toEqual(["board-maker", "offset-printing"]);
    expect(findByPath(tree, ["board-maker", "3d-sign-board", "ss-stainless-steel-sign"])).toMatchObject({ id: "ss", depth: 2 });
    expect(findByPath(tree, ["offset-printing", "nope"])).toBeNull();
  });

  it("counts products in the whole subtree and leaves hidden branches out", () => {
    const cards = findByPath(tree, ["offset-printing", "business-cards"])!;
    expect(cards.productCount).toBe(3); // 1 direct + 2 in Matte; Foil is hidden
    expect(cards.children.map((c) => c.slug)).toEqual(["matte"]);
    expect(descendantIds(cards)).toEqual(["cards", "matte"]);
    expect(findByPath(buildTree(rows, { includeHidden: true }), ["offset-printing", "business-cards"])!.productCount).toBe(7);
  });

  it("walks ancestors and siblings", () => {
    const matte = findByPath(tree, ["offset-printing", "business-cards", "matte"])!;
    expect(ancestry(tree, matte).map((c) => c.id)).toEqual(["offset", "cards", "matte"]);
    expect(siblings(tree, tree[0]).map((c) => c.id)).toEqual(["offset"]);
  });

  it("builds clean URLs", () => {
    expect(serviceUrl(["board-maker", "3d-sign-board"])).toBe("/services/board-maker/3d-sign-board");
    expect(categoryUrl(["offset-printing", "business-cards", "matte"])).toBe("/products/offset-printing/business-cards/matte");
    expect(productUrl(["offset-printing", "business-cards"], "standard-business-cards")).toBe(
      "/products/offset-printing/business-cards/standard-business-cards",
    );
  });

  it("writes default SEO titles", () => {
    const matte = findByPath(tree, ["offset-printing", "business-cards", "matte"])!;
    expect(defaultCategoryTitle(matte, ancestry(tree, matte))).toBe("Matte Business Cards Printing in Lahore | Mix Print Design");
    const board = findByPath(tree, ["board-maker"])!;
    expect(defaultCategoryTitle(board, [board])).toBe("Board Maker in Lahore | Mix Print Design");
    const ss = findByPath(tree, ["board-maker", "3d-sign-board", "ss-stainless-steel-sign"])!;
    expect(defaultCategoryTitle(ss, ancestry(tree, ss))).toBe("Ss Stainless Steel Sign in Lahore | Mix Print Design");
  });

  it("shortens meta descriptions at a word boundary", () => {
    expect(metaDescription("Short text.")).toBe("Short text.");
    const long = metaDescription("word ".repeat(60))!;
    expect(long.length).toBeLessThanOrEqual(159);
    expect(long.endsWith("word…")).toBe(true);
  });
});
