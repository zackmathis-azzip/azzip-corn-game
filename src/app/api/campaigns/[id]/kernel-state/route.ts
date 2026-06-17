import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getKernelState, getKernelsForCampaign, getPlayerState } from "@/lib/game";
import { getSessionToken } from "@/lib/session";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const campaign = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id);

  if (!campaign) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const state = getKernelState(id);
  const sessionToken = await getSessionToken();
  const player = sessionToken ? getPlayerState(sessionToken) : null;

  const url = new URL(request.url);
  const includeKernels = url.searchParams.get("kernels") !== "0";

  const kernels = includeKernels
    ? getKernelsForCampaign(id).map((k) => ({
        id: k.id,
        row: k.row,
        col: k.col,
        active: k.active === 1,
        status: k.status,
        color: k.color,
      }))
    : undefined;

  return NextResponse.json({
    campaignId: id,
    status: (campaign as { status: string }).status,
    claimedKernelIds: state.claimedKernelIds,
    playerStatus: player?.status ?? null,
    pendingClaimId: player?.pending_claim_id ?? null,
    kernels,
  });
}
