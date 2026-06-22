import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { sendWinnerEmailForClaim } from "@/lib/winner-emails";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { claimId?: string; allowResend?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.claimId) {
    return NextResponse.json({ error: "claimId required" }, { status: 400 });
  }

  try {
    const result = await sendWinnerEmailForClaim(body.claimId, {
      allowResend: body.allowResend === true,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    const status = message.includes("already notified") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
