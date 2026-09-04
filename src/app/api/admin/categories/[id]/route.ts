import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../../lib/adminRoute";
import { categoriesStore, validateName } from "../../../../../lib/adminStore";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request); if (denied) return denied;
  const category = categoriesStore.get((await params).id); if (!category) return jsonError("Category not found.", 404, "NOT_FOUND");
  return NextResponse.json({ success: true, data: category });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request); if (denied) return denied;
  const category = categoriesStore.get((await params).id); if (!category) return jsonError("Category not found.", 404, "NOT_FOUND");
  const body = await request.json(); const name = body.name === undefined ? category.name : validateName(body.name);
  if (!name) return jsonError("A valid category name is required.");
  Object.assign(category, { name, productType: body.productType === "FOOD" ? "FOOD" : body.productType === "BEVERAGE" ? "BEVERAGE" : category.productType, sortOrder: body.sortOrder === undefined ? category.sortOrder : Number(body.sortOrder), isActive: body.isActive === undefined ? category.isActive : Boolean(body.isActive), isArchived: body.isArchived === undefined ? category.isArchived : Boolean(body.isArchived) });
  return NextResponse.json({ success: true, data: category, category });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request); if (denied) return denied;
  const category = categoriesStore.get((await context.params).id);
  if (!category) return jsonError("Category not found.", 404, "NOT_FOUND");
  category.isArchived = true;
  category.isActive = false;
  return NextResponse.json({ success: true, data: category, category });
}
