import { boardMaker } from "./board-maker";
import { customizedPrinting } from "./customized-printing";
import { digitalPrinting } from "./digital-printing";
import { offsetPrinting } from "./offset-printing";
import { EXTRA_CONTENT } from "./extra-content";
import type { TaxonomyNode } from "./types";

export type { TaxonomyNode };

/** Inserts extra detail paragraphs before each page's closing call-to-action paragraph. */
function withExtra(node: TaxonomyNode, path: string): TaxonomyNode {
  const extra = EXTRA_CONTENT[path];
  const paragraphs = node.content.split("\n\n");
  const content = extra ? [...paragraphs.slice(0, -1), extra, paragraphs.at(-1)!].join("\n\n") : node.content;
  return { ...node, content, children: node.children?.map((c) => withExtra(c, `${path}/${c.slug}`)) };
}

/** The four main services, in display order. */
export const TAXONOMY: TaxonomyNode[] = [boardMaker, offsetPrinting, digitalPrinting, customizedPrinting].map((n) =>
  withExtra(n, n.slug),
);
