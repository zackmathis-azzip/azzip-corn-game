import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getCurrentCampaign } from "@/lib/db";
import { listWinnerEmails } from "@/lib/winner-emails";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaign = await getCurrentCampaign();
  if (!campaign) {
    return NextResponse.json({ campaign: null, winners: [] });
  }

  const winners = await listWinnerEmails(campaign.id);
  const pending = winners.filter((w) => !w.voided && !w.notifiedAt).length;
  const sent = winners.filter((w) => !w.voided && w.notifiedAt).length;

  return NextResponse.json({
    campaign: { id: campaign.id, name: campaign.name },
    winners,
    summary: { total: winners.length, pending, sent, voided: winners.filter((w) => w.voided).length },
  });
}
