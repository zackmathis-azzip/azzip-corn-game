import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { seedCampaign } from "@/lib/seed";
import { auditLog, getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    startsAt?: string;
    endsAt?: string;
    seed?: number;
    force?: boolean;
  } = {};

  try {
    body = await request.json();
  } catch {
    // default seed
  }

  if (body.force !== false) {
    getDb().prepare(`UPDATE campaigns SET status = 'ended' WHERE status = 'active'`).run();
  }

  const id = seedCampaign({
    name: body.name,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    seed: body.seed,
  });

  auditLog("admin_seed", id, "admin", { seed: body.seed });
  return NextResponse.json({ success: true, campaignId: id });
}
