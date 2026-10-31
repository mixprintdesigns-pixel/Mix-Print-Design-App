import Link from "next/link";
import { BlogEditor } from "@/components/admin/blog/blog-editor";
import { requireStaff } from "@/lib/auth/session";
import { blogEditorData } from "@/lib/blog/editor-data";

export const metadata = { title: "New article" };

export default async function NewBlogArticlePage() {
  await requireStaff(["ADMIN"]);
  const data = (await blogEditorData(null))!;
  return (
    <>
      <Link href="/admin/blog" className="text-sm text-muted hover:text-foreground">
        ← Blog
      </Link>
      <h1 className="mt-1 text-2xl font-bold">New article</h1>
      <div className="mt-6">
        <BlogEditor postId={null} {...data} />
      </div>
    </>
  );
}
