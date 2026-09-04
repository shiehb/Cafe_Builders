import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../lib/adminRoute";
import { adminService } from "../../../../services";

export async function GET(request: Request) {
  const denied = adminAuth(request);
  if (denied) return denied;
  try {
    const data = await adminService.listCustomizationGroups();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to list customization groups", 500, "SERVER_ERROR");
  }
}

export async function POST(request: Request) {
  const denied = adminAuth(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return jsonError("A valid customization group name is required.");
    const group = await adminService.createCustomizationGroup({
      name,
      selectionMode: body.selectionMode === "MULTIPLE" ? "MULTIPLE" : "SINGLE",
      isRequired: Boolean(body.isRequired),
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      isActive: body.isActive !== false,
    });
    return NextResponse.json({ success: true, data: group, group }, { status: 201 });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to create customization group", 500, "SERVER_ERROR");
  }
}
