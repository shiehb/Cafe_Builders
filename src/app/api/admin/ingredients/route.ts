import { NextResponse } from "next/server";
import { adminAuth, jsonError } from "../../../../lib/adminRoute";
import { ingredientsStore, ingredientProducts, validateName } from "../../../../lib/adminStore";

export async function GET(request: Request) { const denied = adminAuth(request); if (denied) return denied; return NextResponse.json({ success: true, data: Array.from(ingredientsStore.values()).map((ingredient) => ({ ...ingredient, productIds: ingredientProducts(ingredient.id).map((product) => product.id) })) }); }
export async function POST(request: Request) { const denied = adminAuth(request); if (denied) return denied; const body = await request.json(); const name = validateName(body.name); if (!name) return jsonError("A valid ingredient name is required."); const id = `ingredient_${Date.now()}`; const ingredient = { id, name, isAvailable: body.isAvailable !== false }; ingredientsStore.set(id, ingredient); return NextResponse.json({ success: true, data: ingredient, ingredient }, { status: 201 }); }
