import { NextResponse } from "next/server";
import { auditLog, getActiveCampaign, sqlRun } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaign = await getActiveCampaign();
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
  await sqlRun(`UPDATE campaigns SET status = ? WHERE id = ?`, [newStatus, campaign.id]);

  await auditLog("kill_switch", campaign.id, "admin", { status: newStatus });
  return NextResponse.json({ success: true, status: newStatus });
}
