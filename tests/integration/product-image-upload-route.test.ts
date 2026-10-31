import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPayloadFromClientToken } from "@vercel/blob/client";
import { createTestProduct, resetDatabase } from "../support/db";

// The route that gives the admin's browser a token for a direct upload to Vercel Blob.

const session = vi.hoisted(() => ({ user: null as null | { id: string; name: string; email: string; role: string } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => session.user }));

const { POST } = await import("@/app/api/admin/product-images/upload/route");

const TOKEN = "vercel_blob_rw_AbC123xyz_secretpart";
const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

beforeEach(async () => {
  await resetDatabase();
  process.env.BLOB_READ_WRITE_TOKEN = TOKEN;
  session.user = { id: "u1", name: "Admin", email: "admin@example.com", role: "ADMIN" };
});
afterEach(() => {
  process.env.BLOB_READ_WRITE_TOKEN = originalToken;
});

const ask = (pathname: string, productId: string) =>
  POST(
    new Request("https://www.mixprintdesign.com/api/admin/product-images/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname, clientPayload: productId, multipart: false } }),
    }),
  );

describe("product image upload token", () => {
  it("gives an admin a token for this product's upload folder only", async () => {
    const product = await createTestProduct();
    const res = await ask(`products/${product.id}/upload-card.webp`, product.id);
    expect(res.status).toBe(200);
    const { clientToken } = await res.json();
    const payload = getPayloadFromClientToken(clientToken);
    expect(payload).toMatchObject({ pathname: `products/${product.id}/upload-card.webp`, addRandomSuffix: true });
    expect(payload.allowedContentTypes).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("refuses visitors who are not admins, other folders and missing products", async () => {
    const product = await createTestProduct();
    expect(await (await ask(`products/${product.id}/upload-x.webp`, "missing")).json()).toMatchObject({ error: "This product no longer exists." });
    expect(await (await ask(`products/other/upload-x.webp`, product.id)).json()).toMatchObject({ error: "Invalid file name." });
    session.user = { id: "u2", name: "Customer", email: "c@example.com", role: "CUSTOMER" };
    const res = await ask(`products/${product.id}/upload-x.webp`, product.id);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Only administrators/);
  });

  it("says when the Blob read-write token is missing", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const product = await createTestProduct();
    expect((await (await ask(`products/${product.id}/upload-x.webp`, product.id)).json()).error).toMatch(/BLOB_READ_WRITE_TOKEN/);
  });
});
