import { NextResponse } from "next/server";
import { getActiveCampaign, sqlAll, sqlGet } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getClaimsForCampaign, getPrizesForCampaign } from "@/lib/game";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaign = await getActiveCampaign();
  if (!campaign) {
    return NextResponse.json({ campaign: null, prizes: [], claims: [], stats: null });
  }

  const prizes = await getPrizesForCampaign(campaign.id);
  const claims = await getClaimsForCampaign(campaign.id);

  const kernelStats = await sqlAll<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM kernels WHERE campaign_id = ? GROUP BY status`,
    [campaign.id]
  );

  const completedWinners = await sqlGet<{ count: number }>(
    `SELECT COUNT(*) as count FROM claims WHERE campaign_id = ? AND outcome = 'win' AND status = 'completed'`,
    [campaign.id]
  );

  return NextResponse.json({
    campaign,
    prizes,
    claims,
    stats: {
      kernels: kernelStats,
      completedWinners: completedWinners?.count ?? 0,
    },
  });
}
