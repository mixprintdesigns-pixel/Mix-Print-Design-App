/** The owner's long description of a category (paragraphs separated by blank lines). */
export function CategoryContent({ content, className = "" }: { content: string | null; className?: string }) {
  if (!content) return null;
  return (
    <div className={`space-y-3 leading-relaxed text-muted ${className}`}>
      {content
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </div>
  );
}
