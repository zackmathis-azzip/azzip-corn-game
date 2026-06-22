import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { previewWinnerEmail } from "@/lib/winner-emails";
import { sqlGet } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ claimId: string }> };

export async function GET(_request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { claimId } = await params;
  const claim = await sqlGet<{
    id: string;
    phone_e164: string | null;
    prize_label: string | null;
    email: string | null;
    voided: number | null;
    notified_at: string | null;
  }>(
    `SELECT c.id, c.email, c.phone_e164, c.notified_at, COALESCE(c.voided, 0) as voided,
            p.label as prize_label
     FROM claims c
     LEFT JOIN prizes p ON c.prize_id = p.id
     WHERE c.id = ? AND c.outcome = 'win' AND c.status = 'completed'`,
    [claimId]
  );

  if (!claim) {
    return NextResponse.json({ error: "Winner not found" }, { status: 404 });
  }
  if (!claim.phone_e164) {
    return NextResponse.json({ error: "Claim has no phone on file" }, { status: 400 });
  }

  const preview = previewWinnerEmail(claim.prize_label ?? "Prize", claim.phone_e164);

  return NextResponse.json({
    claimId: claim.id,
    email: claim.email,
    prizeLabel: claim.prize_label,
    notifiedAt: claim.notified_at,
    voided: Boolean(claim.voided),
    preview,
  });
}
