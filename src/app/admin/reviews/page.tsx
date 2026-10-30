import { reviewCommandAction, saveReviewAction } from "@/app/admin/site-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Stars } from "@/components/reviews/review-card";
import { requireStaff } from "@/lib/auth/session";
import { listReviewsForAdmin } from "@/lib/reviews/admin";

export const metadata = { title: "Customer reviews" };

type Review = Awaited<ReturnType<typeof listReviewsForAdmin>>[number];

function ReviewFields({ review }: { review?: Review }) {
  return (
    <>
      {review && <input type="hidden" name="id" value={review.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">Customer name</span>
          <input name="name" className="input" defaultValue={review?.name} required />
        </label>
        <label className="block">
          <span className="label">City / company (optional)</span>
          <input name="location" className="input" defaultValue={review?.location ?? ""} />
        </label>
        <label className="block">
          <span className="label">Rating</span>
          <select name="rating" className="input" defaultValue={review?.rating ?? 5}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Review</span>
        <textarea name="comment" rows={3} className="input" defaultValue={review?.comment} required maxLength={600} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={review?.isPublished ?? true} />
        Show on the home page
      </label>
    </>
  );
}

export default async function AdminReviewsPage() {
  await requireStaff(["ADMIN"]);
  const reviews = await listReviewsForAdmin();
  return (
    <>
      <h1 className="text-2xl font-bold">Customer reviews</h1>
      <p className="mt-1 text-sm text-muted">
        Published reviews appear in the “What our customers say” section of the home page. Only add genuine reviews from real customers.
      </p>

      <ActionForm action={saveReviewAction} className="card mt-6 space-y-3 p-5">
        <h2 className="font-bold">Add a review</h2>
        <ReviewFields />
        <SubmitButton className="btn-primary">Add review</SubmitButton>
      </ActionForm>

      <ul className="mt-6 space-y-4">
        {reviews.length === 0 && <li className="card p-8 text-center text-muted">No reviews yet. The home page hides the section until you add one.</li>}
        {reviews.map((r, i) => (
          <li key={r.id} className="card p-5" data-testid="admin-review">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {r.name} {r.location && <span className="font-normal text-muted">· {r.location}</span>}
                </p>
                <Stars rating={r.rating} />
                {!r.isPublished && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs dark:bg-stone-800">hidden</span>}
                <p className="mt-2 text-sm">“{r.comment}”</p>
              </div>
              <ActionForm action={reviewCommandAction} className="flex gap-1">
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton name="command" value="up" className="btn-secondary px-2 py-1 text-xs">
                  <span aria-label="Move up">↑</span>
                </SubmitButton>
                <SubmitButton name="command" value="down" className="btn-secondary px-2 py-1 text-xs">
                  <span aria-label="Move down">↓</span>
                </SubmitButton>
                {r.isPublished && (
                  <SubmitButton name="command" value="hide" className="btn-secondary px-2 py-1 text-xs">
                    Hide
                  </SubmitButton>
                )}
              </ActionForm>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-brand">Edit</summary>
              <ActionForm action={saveReviewAction} className="mt-3 space-y-3">
                <ReviewFields review={r} />
                <SubmitButton className="btn-secondary">Save review</SubmitButton>
              </ActionForm>
            </details>
            <span className="sr-only">Position {i + 1}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
