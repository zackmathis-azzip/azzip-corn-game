import { NextResponse } from "next/server";
import { getDb, getActiveCampaign } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getClaimsForCampaign, getPrizesForCampaign } from "@/lib/game";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaign = getActiveCampaign();
  if (!campaign) {
    return NextResponse.json({ campaign: null, prizes: [], claims: [], stats: null });
  }

  const db = getDb();
  const prizes = getPrizesForCampaign(campaign.id);
  const claims = getClaimsForCampaign(campaign.id);

  const kernelStats = db
    .prepare(
      `SELECT status, COUNT(*) as count FROM kernels WHERE campaign_id = ? GROUP BY status`
    )
    .all(campaign.id) as Array<{ status: string; count: number }>;

  const completedWinners = db
    .prepare(
      `SELECT COUNT(*) as count FROM claims WHERE campaign_id = ? AND outcome = 'win' AND status = 'completed'`
    )
    .get(campaign.id) as { count: number };

  return NextResponse.json({
    campaign,
    prizes,
    claims,
    stats: {
      kernels: kernelStats,
      completedWinners: completedWinners.count,
    },
  });
}
