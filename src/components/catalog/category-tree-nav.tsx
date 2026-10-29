import Link from "next/link";
import type { CategoryNode } from "@/lib/catalog/tree";

/**
 * The full category tree as an expandable list (no JavaScript needed: <details> elements).
 * Branches leading to the current category start open.
 */
export function CategoryTreeNav({
  tree,
  activePath = [],
  hrefFor,
  allLabel,
  allHref,
  label = "Categories",
}: {
  tree: CategoryNode[];
  activePath?: string[];
  hrefFor: (node: CategoryNode) => string;
  allLabel: string;
  allHref: string;
  label?: string;
}) {
  return (
    <nav aria-label={label} className="text-sm">
      <p className="mb-2 font-semibold">{label}</p>
      <ul className="space-y-0.5">
        <li>
          <Link
            href={allHref}
            aria-current={activePath.length === 0 ? "page" : undefined}
            className={`block rounded px-2 py-1 ${activePath.length === 0 ? "bg-brand/10 font-semibold text-brand" : "hover:text-brand"}`}
          >
            {allLabel}
          </Link>
        </li>
        {tree.map((node) => (
          <TreeItem key={node.id} node={node} activePath={activePath} hrefFor={hrefFor} />
        ))}
      </ul>
    </nav>
  );
}

function TreeItem({ node, activePath, hrefFor }: { node: CategoryNode; activePath: string[]; hrefFor: (node: CategoryNode) => string }) {
  const isActive = node.path.join("/") === activePath.join("/");
  const onActiveBranch = node.path.every((slug, i) => activePath[i] === slug);
  const link = (
    <Link
      href={hrefFor(node)}
      aria-current={isActive ? "page" : undefined}
      className={`flex-1 rounded px-2 py-1 ${isActive ? "bg-brand/10 font-semibold text-brand" : "hover:text-brand"}`}
    >
      {node.name} <span className="text-xs text-muted">({node.productCount})</span>
    </Link>
  );
  if (node.children.length === 0) {
    return (
      <li className="flex items-center gap-0.5">
        <span aria-hidden className="w-4 shrink-0" />
        {link}
      </li>
    );
  }
  return (
    <li>
      <details open={onActiveBranch} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-0.5 [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="w-4 shrink-0 text-center text-xs text-muted transition group-open:rotate-90">
            ▸
          </span>
          {link}
        </summary>
        <ul className="ml-3 space-y-0.5 border-l border-border pl-1">
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} activePath={activePath} hrefFor={hrefFor} />
          ))}
        </ul>
      </details>
    </li>
  );
}
