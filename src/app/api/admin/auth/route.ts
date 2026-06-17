import { NextRequest, NextResponse } from "next/server";
import {
  adminAuthCookieValue,
  ADMIN_COOKIE_OPTIONS,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { ADMIN_COOKIE } from "@/lib/config";

export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.password || !verifyAdminPassword(body.password)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, adminAuthCookieValue(), ADMIN_COOKIE_OPTIONS);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
