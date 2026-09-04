import { NextResponse } from "next/server";
import { isRequestAuthorized } from "./auth";

export function adminAuth(request: Request) {
  const authorized = isRequestAuthorized({ headers: { cookie: request.headers.get("cookie") || undefined, authorization: request.headers.get("authorization") || undefined } });
  return authorized ? null : NextResponse.json({ success: false, code: "UNAUTHORIZED", message: "Admin authentication required." }, { status: 401 });
}

export function jsonError(message: string, status = 400, code = "VALIDATION_ERROR") {
  return NextResponse.json({ success: false, code, message }, { status });
}
