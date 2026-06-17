import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");

  const db = getDb();
  let query = `
    SELECT c.id, c.kernel_id, c.outcome, c.email, c.phone,
           c.email_normalized, c.phone_e164, c.created_at, c.verified_at,
           COALESCE(c.voided, 0) as voided,
           p.label as prize_label, camp.name as campaign_name
    FROM claims c
    LEFT JOIN prizes p ON c.prize_id = p.id
    LEFT JOIN campaigns camp ON c.campaign_id = camp.id
    WHERE c.outcome = 'win' AND c.status = 'completed'
  `;
  const params: string[] = [];

  if (campaignId) {
    query += ` AND c.campaign_id = ?`;
    params.push(campaignId);
  }

  query += ` ORDER BY c.verified_at DESC`;

  const rows = db.prepare(query).all(...params) as Array<Record<string, unknown>>;

  const header = [
    "claim_id",
    "campaign",
    "kernel_id",
    "prize",
    "email",
    "phone",
    "completed_at",
    "voided",
  ];

  const csvLines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.campaign_name,
        r.kernel_id,
        r.prize_label,
        r.email,
        r.phone,
        r.verified_at,
        r.voided,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ];

  return new NextResponse(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="azzip-corn-winners.csv"',
    },
  });
}
