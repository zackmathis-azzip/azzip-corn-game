import { NextResponse } from "next/server";
import { getActiveCampaign } from "@/lib/db";
import { getKernelsForCampaign, getPlayerState } from "@/lib/game";
import {
  createSessionToken,
  getSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/session";

export async function GET() {
  const campaign = getActiveCampaign();
  if (!campaign) {
    return NextResponse.json({ error: "no_campaign" }, { status: 404 });
  }

  let sessionToken = await getSessionToken();
  const response = NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      startsAt: campaign.starts_at,
      endsAt: campaign.ends_at,
      status: campaign.status,
      seed: campaign.seed,
    },
    kernels: getKernelsForCampaign(campaign.id).map((k) => ({
      id: k.id,
      row: k.row,
      col: k.col,
      color: k.color,
      status: k.status,
      active: Boolean(k.active),
    })),
    player: sessionToken ? getPlayerState(sessionToken) : null,
  });

  if (!sessionToken) {
    sessionToken = createSessionToken();
    response.cookies.set(SESSION_COOKIE, sessionToken, SESSION_COOKIE_OPTIONS);
  }

  return response;
}

export async function POST() {
  let sessionToken = await getSessionToken();
  if (!sessionToken) {
    sessionToken = createSessionToken();
  }

  const response = NextResponse.json({ sessionToken });
  response.cookies.set(SESSION_COOKIE, sessionToken, SESSION_COOKIE_OPTIONS);
  return response;
}
