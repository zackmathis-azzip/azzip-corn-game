import { sqlAll, sqlGet, sqlRun, auditLog } from "./db";
import { getWinnerEmailPreview, normalizeEmail, sendWinnerConfirmationEmail } from "./email";

export type WinnerEmailRow = {
  claimId: string;
  email: string;
  phoneE164: string;
  prizeLabel: string;
  kernelId: string;
  completedAt: string;
  notifiedAt: string | null;
  voided: boolean;
};

export async function listWinnerEmails(campaignId: string): Promise<WinnerEmailRow[]> {
  const rows = await sqlAll<{
    id: string;
    email: string | null;
    phone_e164: string | null;
    prize_label: string | null;
    kernel_id: string;
    verified_at: string | null;
    notified_at: string | null;
    voided: number | null;
  }>(
    `SELECT c.id, c.email, c.phone_e164, c.kernel_id, c.verified_at, c.notified_at,
            COALESCE(c.voided, 0) as voided, p.label as prize_label
     FROM claims c
     LEFT JOIN prizes p ON c.prize_id = p.id
     WHERE c.campaign_id = ?
       AND c.outcome = 'win'
       AND c.status = 'completed'
     ORDER BY c.verified_at DESC`,
    [campaignId]
  );

  return rows.map((row) => ({
    claimId: row.id,
    email: row.email ?? "",
    phoneE164: row.phone_e164 ?? "",
    prizeLabel: row.prize_label ?? "Prize",
    kernelId: row.kernel_id,
    completedAt: row.verified_at ?? "",
    notifiedAt: row.notified_at,
    voided: Boolean(row.voided),
  }));
}

export function previewWinnerEmail(prizeLabel: string, phoneE164: string) {
  return getWinnerEmailPreview({ prizeLabel, phoneE164 });
}

export async function sendWinnerEmailForClaim(
  claimId: string,
  options: { allowResend?: boolean } = {}
): Promise<{ claimId: string; toEmail: string; resent: boolean }> {
  const claim = await sqlGet<{
    id: string;
    campaign_id: string;
    email: string | null;
    email_normalized: string | null;
    phone_e164: string | null;
    notified_at: string | null;
    voided: number | null;
    prize_label: string | null;
    ends_at: string | null;
  }>(
    `SELECT c.id, c.campaign_id, c.email, c.email_normalized, c.phone_e164,
            c.notified_at, COALESCE(c.voided, 0) as voided, p.label as prize_label,
            camp.ends_at
     FROM claims c
     LEFT JOIN prizes p ON c.prize_id = p.id
     LEFT JOIN campaigns camp ON c.campaign_id = camp.id
     WHERE c.id = ? AND c.outcome = 'win' AND c.status = 'completed'`,
    [claimId]
  );

  if (!claim) {
    throw new Error("Winner claim not found");
  }
  if (claim.voided) {
    throw new Error("This claim is voided");
  }

  const toEmail = claim.email_normalized ?? normalizeEmail(claim.email ?? "");
  if (!toEmail) {
    throw new Error("Claim has no valid email");
  }
  if (!claim.phone_e164) {
    throw new Error("Claim has no phone number on file");
  }
  if (claim.notified_at && !options.allowResend) {
    throw new Error("Winner was already notified — enable resend to send again");
  }

  await sendWinnerConfirmationEmail({
    toEmail,
    phoneE164: claim.phone_e164,
    prizeLabel: claim.prize_label ?? "Your prize",
    promotionEndsAt: claim.ends_at ?? new Date().toISOString(),
  });

  const now = new Date().toISOString();
  await sqlRun(`UPDATE claims SET notified_at = ? WHERE id = ?`, [now, claimId]);
  await auditLog("winner_email_sent", claim.campaign_id, "admin", {
    claimId,
    toEmail,
    resent: Boolean(claim.notified_at),
  });

  return { claimId, toEmail, resent: Boolean(claim.notified_at) };
}
