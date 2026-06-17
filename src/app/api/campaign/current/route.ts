import { NextResponse } from "next/server";
import { getActiveCampaign } from "@/lib/db";
import { seedCampaign } from "@/lib/seed";

export const runtime = "nodejs";

export async function GET() {
  let campaign = getActiveCampaign();
  if (!campaign) {
    seedCampaign();
    campaign = getActiveCampaign();
  }

  if (!campaign) {
    return NextResponse.json({ campaign: null });
  }

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      startsAt: campaign.starts_at,
      endsAt: campaign.ends_at,
      status: campaign.status,
      seed: campaign.seed,
    },
  });
}
