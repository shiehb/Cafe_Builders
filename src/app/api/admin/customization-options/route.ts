import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../lib/adminRoute";
import { adminService } from "../../../../services";

export async function GET(request: Request) {
  const denied = adminAuth(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId") || undefined;
    const data = await adminService.listCustomizationOptions({ groupId });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to list customization options", 500, "SERVER_ERROR");
  }
}

export async function POST(request: Request) {
  const denied = adminAuth(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const groupId = String(body.groupId || "").trim();
    if (!name || !groupId) return jsonError("Valid option name and groupId are required.");
    const option = await adminService.createCustomizationOption({
      name,
      groupId,
      priceModifier: Number.isFinite(Number(body.priceModifier)) ? Number(body.priceModifier) : 0,
      isActive: body.isActive !== false,
    });
    return NextResponse.json({ success: true, data: option, option }, { status: 201 });
  } catch (error: any) {
    return jsonError(error?.message || "Failed to create customization option", 500, "SERVER_ERROR");
  }
}
