// Pure helpers for the shared category tree (Main Service → Category → Sub-category → …).
// No database or Next.js imports, so they run anywhere and are easy to test.

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  sortOrder: number;
  isVisible: boolean;
  priceFromMinor: number | null;
  priceUnit: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  parentId: string | null;
  /** Published products directly in this category. */
  directProductCount: number;
};

export type CategoryNode = Omit<CategoryRow, "directProductCount"> & {
  /** Slugs from the main service down to this category, e.g. ["offset-printing", "business-cards"]. */
  path: string[];
  depth: number;
  /** Published products in this category and all its sub-categories. */
  productCount: number;
  children: CategoryNode[];
};

/**
 * Builds the tree in sort order. Hidden categories (and everything below them) are left out
 * unless `includeHidden` is set. Rows whose parent is missing become roots.
 */
export function buildTree(rows: CategoryRow[], { includeHidden = false } = {}): CategoryNode[] {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const byParent = new Map<string | null, CategoryRow[]>();
  const ids = new Set(rows.map((r) => r.id));
  for (const row of sorted) {
    const parent = row.parentId && ids.has(row.parentId) ? row.parentId : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), row]);
  }
  const build = (parentId: string | null, path: string[], seen: Set<string>): CategoryNode[] =>
    (byParent.get(parentId) ?? [])
      .filter((r) => (includeHidden || r.isVisible) && !seen.has(r.id))
      .map(({ directProductCount, ...row }) => {
        const nodePath = [...path, row.slug];
        const children = build(row.id, nodePath, new Set([...seen, row.id]));
        return {
          ...row,
          path: nodePath,
          depth: path.length,
          productCount: directProductCount + children.reduce((sum, c) => sum + c.productCount, 0),
          children,
        };
      });
  return build(null, [], new Set());
}

/** The category at a slug path, e.g. ["board-maker", "3d-sign-board"]. */
export function findByPath(tree: CategoryNode[], segments: string[]): CategoryNode | null {
  let level = tree;
  let node: CategoryNode | null = null;
  for (const slug of segments) {
    node = level.find((c) => c.slug === slug) ?? null;
    if (!node) return null;
    level = node.children;
  }
  return node;
}

export function findById(tree: CategoryNode[], id: string): CategoryNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findById(node.children, id);
    if (found) return found;
  }
  return null;
}

/** The chain of categories from the main service to `node` (inclusive). */
export function ancestry(tree: CategoryNode[], node: CategoryNode): CategoryNode[] {
  return node.path.map((_, i) => findByPath(tree, node.path.slice(0, i + 1))!).filter(Boolean);
}

export function descendantIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(descendantIds)];
}

export function flatten(tree: CategoryNode[]): CategoryNode[] {
  return tree.flatMap((n) => [n, ...flatten(n.children)]);
}

/** Other categories under the same parent. */
export function siblings(tree: CategoryNode[], node: CategoryNode): CategoryNode[] {
  const parent = node.path.length > 1 ? findByPath(tree, node.path.slice(0, -1)) : null;
  return (parent ? parent.children : tree).filter((c) => c.id !== node.id);
}

// ─── URLs ─────────────────────────────────────────────────────────────────────

export const serviceUrl = (path: string[]) => (path.length ? `/services/${path.join("/")}` : "/services");
export const categoryUrl = (path: string[]) => (path.length ? `/products/${path.join("/")}` : "/products");
export const productUrl = (categoryPath: string[], productSlug: string) => `/products/${[...categoryPath, productSlug].join("/")}`;

// ─── SEO defaults ─────────────────────────────────────────────────────────────

const stems = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9]+/g)?.map((w) => w.replace(/s$/, "")) ?? []);

/** "Matte Business Cards Printing in Lahore | Mix Print Design" style default titles. */
export function defaultCategoryTitle(node: Pick<CategoryNode, "name" | "path">, ancestors: Pick<CategoryNode, "name">[] = []): string {
  const parent = node.path.length >= 3 && ancestors.length >= 2 ? ancestors[ancestors.length - 2].name : null;
  // A one-word sub-category name gets its parent's name for context ("Matte" → "Matte Business Cards",
  // "Tri-fold" → "Tri-fold Brochures"), unless it already shares a word with it.
  const parentWords = parent ? stems(parent) : new Set<string>();
  const short = !/\s/.test(node.name.trim());
  const name = parent && short && ![...stems(node.name)].some((w) => parentWords.has(w)) ? `${node.name} ${parent}` : node.name;
  const service = /print|sign|board|engraving|award|plate|banner/i.test(name) ? name : `${name} Printing`;
  return `${service} in Lahore | Mix Print Design`;
}

/** Shortens text to a meta-description length at a word boundary. */
export function metaDescription(text: string | null | undefined, max = 158): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, clean.lastIndexOf(" ", max - 1)).replace(/[,.;:]$/, "")}…`;
}
