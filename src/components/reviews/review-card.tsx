export function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500" role="img" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      <span className="text-stone-300 dark:text-stone-600">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function ReviewCard({ review }: { review: { name: string; location: string | null; rating: number; comment: string } }) {
  return (
    <figure className="card flex h-full flex-col p-5" data-testid="review-card">
      <Stars rating={review.rating} />
      <blockquote className="mt-3 flex-1 leading-relaxed">“{review.comment}”</blockquote>
      <figcaption className="mt-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand/15 font-bold text-brand" aria-hidden>
          {review.name.charAt(0).toUpperCase()}
        </span>
        <span>
          <span className="block font-semibold">{review.name}</span>
          {review.location && <span className="block text-xs text-muted">{review.location}</span>}
        </span>
      </figcaption>
    </figure>
  );
}
