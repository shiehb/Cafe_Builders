import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../lib/adminRoute";
import { groupsStore, validateName } from "../../../../lib/adminStore";

export async function GET(request: Request) { const denied = adminAuth(request); if (denied) return denied; return NextResponse.json({ success: true, data: Array.from(groupsStore.values()) }); }
export async function POST(request: Request) { const denied = adminAuth(request); if (denied) return denied; const body = await request.json(); const name = validateName(body.name); if (!name) return jsonError("A valid customization group name is required."); const id = `group_${Date.now()}`; const group = { id, name, selectionMode: body.selectionMode === "MULTIPLE" ? "MULTIPLE" as const : "SINGLE" as const, isRequired: body.isRequired === true, sortOrder: Number(body.sortOrder) || groupsStore.size, isActive: body.isActive !== false }; groupsStore.set(id, group); return NextResponse.json({ success: true, data: group, group }, { status: 201 }); }
