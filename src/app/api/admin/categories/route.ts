import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../lib/adminRoute";
import { categoriesStore, validateName } from "../../../../lib/adminStore";

export async function GET(request: Request) {
  const denied = adminAuth(request); if (denied) return denied;
  return NextResponse.json({ success: true, data: Array.from(categoriesStore.values()) });
}

export async function POST(request: Request) {
  const denied = adminAuth(request); if (denied) return denied;
  const body = await request.json(); const name = validateName(body.name);
  if (!name) return jsonError("A valid category name is required.");
  const id = `cat_${Date.now()}`;
  const category = { id, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), productType: body.productType === "FOOD" ? "FOOD" as const : "BEVERAGE" as const, sortOrder: Number(body.sortOrder) || categoriesStore.size, isActive: body.isActive !== false };
  categoriesStore.set(id, category);
  return NextResponse.json({ success: true, data: category, category }, { status: 201 });
}
