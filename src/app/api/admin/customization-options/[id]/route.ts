import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../../lib/adminRoute";
import { adminService } from "../../../../../services";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const option = await adminService.getCustomizationOptionById(id);
    if (!option) return jsonError("Customization option not found.", 404, "NOT_FOUND");
    return NextResponse.json({ success: true, data: option, option });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to get customization option", 500, "SERVER_ERROR");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    if (name !== undefined && !name) return jsonError("A valid customization option name is required.");
    const option = await adminService.updateCustomizationOption(id, {
      name,
      groupId: body.groupId !== undefined ? String(body.groupId).trim() : undefined,
      priceModifier: body.priceModifier !== undefined ? Number(body.priceModifier) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      isArchived: body.isArchived !== undefined ? Boolean(body.isArchived) : undefined,
    });
    return NextResponse.json({ success: true, data: option, option });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to update customization option", 500, "SERVER_ERROR");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const option = await adminService.archiveCustomizationOption(id);
    return NextResponse.json({ success: true, data: option, option });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to delete customization option", 500, "SERVER_ERROR");
  }
}
