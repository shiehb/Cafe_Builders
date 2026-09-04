import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../../lib/adminRoute";
import { adminService } from "../../../../../services";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const category = await adminService.getCategoryById(id);
    if (!category) return jsonError("Category not found.", 404, "NOT_FOUND");
    return NextResponse.json({ success: true, data: category, category });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to get category", 500, "SERVER_ERROR");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    if (name !== undefined && !name) return jsonError("A valid category name is required.");
    const category = await adminService.updateCategory(id, {
      name,
      slug: body.slug !== undefined ? String(body.slug).trim() : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      icon: body.icon !== undefined ? String(body.icon).trim() : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });
    return NextResponse.json({ success: true, data: category, category });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to update category", 500, "SERVER_ERROR");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const category = await adminService.deleteCategory(id);
    return NextResponse.json({ success: true, data: category, category });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to delete category", 500, "SERVER_ERROR");
  }
}
