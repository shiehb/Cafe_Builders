import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../lib/adminRoute";
import { inventoryService } from "../../../../services";

export async function GET(request: Request) {
  const denied = adminAuth(request);
  if (denied) return denied;
  try {
    const data = await inventoryService.listIngredients({ includeArchived: true });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to list ingredients", 500, "SERVER_ERROR");
  }
}

export async function POST(request: Request) {
  const denied = adminAuth(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return jsonError("A valid ingredient name is required.");
    const ingredient = await inventoryService.createIngredient({
      name,
      isAvailable: body.isAvailable !== false,
    });
    return NextResponse.json({ success: true, data: ingredient, ingredient }, { status: 201 });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to create ingredient", 500, "SERVER_ERROR");
  }
}
