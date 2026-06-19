import { NextResponse } from "next/server";
import { getCurrentCampaign } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const campaign = await getCurrentCampaign();

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
