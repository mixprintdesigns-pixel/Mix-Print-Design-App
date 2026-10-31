import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBlogPostAction } from "@/app/admin/blog-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { BlogEditor } from "@/components/admin/blog/blog-editor";
import { requireStaff } from "@/lib/auth/session";
import { blogEditorData } from "@/lib/blog/editor-data";

export const metadata = { title: "Edit article" };

export default async function EditBlogArticlePage({ params, searchParams }: PageProps<"/admin/blog/[id]">) {
  await requireStaff(["ADMIN"]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await blogEditorData(id);
  if (!data?.post) notFound();
  return (
    <>
      <Link href="/admin/blog" className="text-sm text-muted hover:text-foreground">
        ← Blog
      </Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Edit article</h1>
        <ActionForm action={deleteBlogPostAction} confirm={`Delete “${data.post.title}” permanently? This cannot be undone.`}>
          <input type="hidden" name="postId" value={data.post.id} />
          <SubmitButton className="btn-secondary px-3 py-1.5 text-sm text-red-700 dark:text-red-400">Delete article</SubmitButton>
        </ActionForm>
      </div>
      {sp.created && (
        <p className="mt-3 text-sm text-green-700 dark:text-green-400" role="status">
          Article created.
        </p>
      )}
      <div className="mt-6">
        <BlogEditor postId={data.post.id} {...data} />
      </div>
    </>
  );
}
