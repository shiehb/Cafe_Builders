import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../../lib/adminRoute";
import { inventoryService } from "../../../../../services";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const ingredient = await inventoryService.getIngredientById(id);
    if (!ingredient) return jsonError("Ingredient not found.", 404, "NOT_FOUND");
    return NextResponse.json({ success: true, data: ingredient, ingredient });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to get ingredient", 500, "SERVER_ERROR");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    if (name !== undefined && !name) return jsonError("A valid ingredient name is required.");
    const ingredient = await inventoryService.updateIngredient(id, {
      name,
      isAvailable: body.isAvailable !== undefined ? Boolean(body.isAvailable) : undefined,
      isArchived: body.isArchived !== undefined ? Boolean(body.isArchived) : undefined,
    });
    return NextResponse.json({ success: true, data: ingredient, ingredient });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to update ingredient", 500, "SERVER_ERROR");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminAuth(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const ingredient = await inventoryService.archiveIngredient(id);
    return NextResponse.json({ success: true, data: ingredient, ingredient });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to delete ingredient", 500, "SERVER_ERROR");
  }
}
