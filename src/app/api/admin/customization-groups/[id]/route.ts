import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../../lib/adminRoute";
import { adminService } from "../../../../../services";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const group = await adminService.getCustomizationGroupById(id);
    if (!group) return jsonError("Customization group not found.", 404, "NOT_FOUND");
    return NextResponse.json({ success: true, data: group, group });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to get customization group", 500, "SERVER_ERROR");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    if (name !== undefined && !name) return jsonError("A valid customization group name is required.");
    const group = await adminService.updateCustomizationGroup(id, {
      name,
      selectionMode: body.selectionMode,
      isRequired: body.isRequired !== undefined ? Boolean(body.isRequired) : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      isArchived: body.isArchived !== undefined ? Boolean(body.isArchived) : undefined,
    });
    return NextResponse.json({ success: true, data: group, group });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to update customization group", 500, "SERVER_ERROR");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const group = await adminService.archiveCustomizationGroup(id);
    return NextResponse.json({ success: true, data: group, group });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to delete customization group", 500, "SERVER_ERROR");
  }
}
