import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../lib/adminRoute";
import { groupsStore, optionsStore, validateName } from "../../../../lib/adminStore";

export async function GET(request: Request) { const denied = adminAuth(request); if (denied) return denied; return NextResponse.json({ success: true, data: Array.from(optionsStore.values()) }); }
export async function POST(request: Request) { const denied = adminAuth(request); if (denied) return denied; const body = await request.json(); const name = validateName(body.name); const groupId = String(body.groupId || ""); if (!name || !groupsStore.has(groupId)) return jsonError("Valid option name and group are required."); const id = `option_${Date.now()}`; const option = { id, groupId, name, priceModifier: Number.isFinite(Number(body.priceModifier)) ? Number(body.priceModifier) : 0, isActive: body.isActive !== false }; optionsStore.set(id, option); return NextResponse.json({ success: true, data: option, option }, { status: 201 }); }
