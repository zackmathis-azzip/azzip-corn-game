import { NextResponse } from "next/server";
import { auditLog, sqlGet, withTransaction } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { claimId?: string; void?: boolean; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shouldVoid = body.void === true || body.action === "void";
  if (!body.claimId || !shouldVoid) {
    return NextResponse.json({ error: "claimId and void action required" }, { status: 400 });
  }

  const claim = await sqlGet<{
    id: string;
    campaign_id: string;
    prize_id: string | null;
    outcome: string;
    status: string;
  }>(`SELECT * FROM claims WHERE id = ?`, [body.claimId]);

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (claim.status === "voided") {
    return NextResponse.json({ success: true, alreadyVoided: true });
  }

  await withTransaction(async (tx) => {
    await tx.run(`UPDATE claims SET status = 'voided' WHERE id = ?`, [body.claimId!]);

    if (claim.outcome === "win" && claim.prize_id) {
      await tx.run(
        `UPDATE prizes SET quantity_remaining = quantity_remaining + 1 WHERE id = ?`,
        [claim.prize_id]
      );
    }
  });

  await auditLog("void_claim", claim.campaign_id, "admin", { claimId: body.claimId });

  return NextResponse.json({ success: true });
}
