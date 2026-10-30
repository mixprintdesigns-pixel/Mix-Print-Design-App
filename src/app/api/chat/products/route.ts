import { NextResponse } from "next/server";
import { listProducts, startingUnitPrice } from "@/lib/catalog/queries";

// Products the visitor can choose when ordering in the AI chat.
export async function GET() {
  const products = await listProducts({ sort: "name" });
  return NextResponse.json(
    products.map((p) => ({ id: p.id, name: p.name, minQuantity: p.minQuantity, fromMinor: startingUnitPrice(p), category: p.category.name })),
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
