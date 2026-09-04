import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../lib/adminRoute";
import { adminService } from "../../../../services";

export async function GET(request: Request) {
  const denied = adminAuth(request);
  if (denied) return denied;
  try {
    const data = await adminService.listCategories();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to list categories", 500, "SERVER_ERROR");
  }
}

export async function POST(request: Request) {
  const denied = adminAuth(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return jsonError("A valid category name is required.");
    const category = await adminService.createCategory({
      name,
      slug: body.slug ? String(body.slug).trim() : undefined,
      description: body.description ? String(body.description).trim() : undefined,
      icon: body.icon || body.iconName ? String(body.icon || body.iconName).trim() : undefined,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    });
    return NextResponse.json({ success: true, data: category, category }, { status: 201 });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to create category", 500, "SERVER_ERROR");
  }
}
