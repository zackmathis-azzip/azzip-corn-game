import { NextResponse } from "next/server";
import { getDb, getActiveCampaign, auditLog } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaign = getActiveCampaign();
  if (!campaign) {
    return NextResponse.json({ error: "No active campaign" }, { status: 404 });
  }

  let body: { paused?: boolean } = { paused: true };
  try {
    body = await request.json();
  } catch {
    // default pause
  }

  const newStatus = body.paused === false ? "active" : "paused";
  getDb()
    .prepare(`UPDATE campaigns SET status = ? WHERE id = ?`)
    .run(newStatus, campaign.id);

  auditLog("kill_switch", campaign.id, "admin", { status: newStatus });
  return NextResponse.json({ success: true, status: newStatus });
}
