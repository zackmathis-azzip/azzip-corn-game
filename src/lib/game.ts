import { randomUUID } from "crypto";
import {
  auditLog,
  getActiveCampaign,
  getDb,
  isCampaignPlayable,
  type CampaignRow,
  type ClaimRow,
  type KernelRow,
  type PlayerRow,
  type PrizeRow,
} from "./db";
import { normalizeEmail, notifyWinner } from "./email";
import { normalizePhone } from "./phone";

export type ClaimResult =
  | { ok: true; outcome: "win" | "lose"; claimId: string; prizeLabel?: string }
  | { ok: false; error: string; message: string };

export type CompleteClaimResult =
  | { ok: true; claimId: string }
  | { ok: false; error: string; message: string };

export function getOrCreatePlayer(
  sessionToken: string,
  campaignId: string
): PlayerRow {
  const db = getDb();
  const existing = db
    .prepare(`SELECT * FROM players WHERE session_token = ?`)
    .get(sessionToken) as PlayerRow | undefined;

  if (existing) return existing;

  const player: PlayerRow = {
    id: randomUUID(),
    session_token: sessionToken,
    campaign_id: campaignId,
    first_click_at: null,
    status: "new",
    pending_claim_id: null,
    created_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO players (id, session_token, campaign_id, status, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(player.id, player.session_token, player.campaign_id, player.status, player.created_at);

  return player;
}

export function claimKernel(params: {
  kernelId: string;
  sessionToken: string;
  ip: string;
  userAgent: string;
}): ClaimResult {
  const campaign = getActiveCampaign();
  if (!campaign) {
    return { ok: false, error: "no_campaign", message: "No active campaign." };
  }

  const playable = isCampaignPlayable(campaign);
  if (!playable.playable) {
    return {
      ok: false,
      error: playable.reason ?? "campaign_unavailable",
      message: "This promotion is not currently available.",
    };
  }

  const db = getDb();
  const player = getOrCreatePlayer(params.sessionToken, campaign.id);

  if (player.status !== "new") {
    return {
      ok: false,
      error: "already_played",
      message: "You have already played. One play per person.",
    };
  }

  const kernel = db
    .prepare(`SELECT * FROM kernels WHERE id = ? AND campaign_id = ?`)
    .get(params.kernelId, campaign.id) as KernelRow | undefined;

  if (!kernel || !kernel.active) {
    return { ok: false, error: "invalid_kernel", message: "Invalid kernel." };
  }

  if (kernel.status === "claimed") {
    return {
      ok: false,
      error: "kernel_taken",
      message: "This kernel was already claimed. Try another!",
    };
  }

  if (kernel.status !== "available") {
    return { ok: false, error: "kernel_unavailable", message: "Kernel unavailable." };
  }

  const claimId = randomUUID();
  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    const update = db
      .prepare(
        `UPDATE kernels
         SET status = 'claimed', claimed_at = ?, claimed_by_player_id = ?
         WHERE id = ? AND status = 'available'`
      )
      .run(now, player.id, params.kernelId);

    if (update.changes === 0) {
      return { race: true as const };
    }

    let prize: PrizeRow | undefined;
    if (kernel.prize_id) {
      prize = db
        .prepare(`SELECT * FROM prizes WHERE id = ? AND quantity_remaining > 0`)
        .get(kernel.prize_id) as PrizeRow | undefined;

      if (prize) {
        const dec = db
          .prepare(
            `UPDATE prizes SET quantity_remaining = quantity_remaining - 1
             WHERE id = ? AND quantity_remaining > 0`
          )
          .run(kernel.prize_id);
        if (dec.changes === 0) {
          prize = undefined;
        }
      }
    }

    const isWin = Boolean(prize);
    const outcome = isWin ? "win" : "lose";
    const status = isWin ? "pending" : "completed";

    db.prepare(
      `INSERT INTO claims (
        id, campaign_id, kernel_id, player_id, prize_id, outcome, status,
        ip, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      claimId,
      campaign.id,
      params.kernelId,
      player.id,
      prize?.id ?? null,
      outcome,
      status,
      params.ip,
      params.userAgent,
      now
    );

    const playerStatus = isWin ? "winner_pending" : "finished";
    db.prepare(
      `UPDATE players SET status = ?, first_click_at = ?, pending_claim_id = ? WHERE id = ?`
    ).run(playerStatus, now, isWin ? claimId : null, player.id);

    return { race: false as const, isWin, prize };
  });

  const result = transaction();

  if (result.race) {
    return {
      ok: false,
      error: "kernel_taken",
      message: "This kernel was just claimed. Try another!",
    };
  }

  auditLog("kernel_claim", campaign.id, player.id, {
    kernelId: params.kernelId,
    outcome: result.isWin ? "win" : "lose",
    claimId,
  });

  if (result.isWin && result.prize) {
    return {
      ok: true,
      outcome: "win",
      claimId,
      prizeLabel: result.prize.label,
    };
  }

  return { ok: true, outcome: "lose", claimId };
}

export function completeClaim(params: {
  claimId: string;
  sessionToken: string;
  email: string;
  phone: string;
  consent: boolean;
  ip: string;
  userAgent: string;
}): CompleteClaimResult {
  if (!params.consent) {
    return {
      ok: false,
      error: "consent_required",
      message: "You must agree to the terms to claim your prize.",
    };
  }

  const emailNorm = normalizeEmail(params.email);
  const phoneE164 = normalizePhone(params.phone);

  if (!emailNorm) {
    return { ok: false, error: "invalid_email", message: "Please enter a valid email." };
  }
  if (!phoneE164) {
    return { ok: false, error: "invalid_phone", message: "Please enter a valid US phone number." };
  }

  const db = getDb();
  const player = db
    .prepare(`SELECT * FROM players WHERE session_token = ?`)
    .get(params.sessionToken) as PlayerRow | undefined;

  if (!player || player.status !== "winner_pending" || player.pending_claim_id !== params.claimId) {
    return { ok: false, error: "invalid_claim", message: "Invalid or expired claim." };
  }

  const claim = db
    .prepare(`SELECT * FROM claims WHERE id = ? AND player_id = ? AND status = 'pending'`)
    .get(params.claimId, player.id) as ClaimRow | undefined;

  if (!claim) {
    return { ok: false, error: "invalid_claim", message: "Claim not found." };
  }

  const dupEmail = db
    .prepare(
      `SELECT id FROM claims
       WHERE email_normalized = ? AND outcome = 'win' AND status = 'completed' AND id != ?`
    )
    .get(emailNorm, params.claimId) as { id: string } | undefined;

  if (dupEmail) {
    return {
      ok: false,
      error: "duplicate_identity",
      message: "This email has already won a prize in this promotion.",
    };
  }

  const dupPhone = db
    .prepare(
      `SELECT id FROM claims
       WHERE phone_e164 = ? AND outcome = 'win' AND status = 'completed' AND id != ?`
    )
    .get(phoneE164, params.claimId) as { id: string } | undefined;

  if (dupPhone) {
    return {
      ok: false,
      error: "duplicate_identity",
      message: "This phone number has already won a prize in this promotion.",
    };
  }

  const now = new Date().toISOString();
  const prize = claim.prize_id
    ? (db.prepare(`SELECT * FROM prizes WHERE id = ?`).get(claim.prize_id) as PrizeRow)
    : null;

  db.prepare(
    `UPDATE claims SET
      email = ?, phone = ?, email_normalized = ?, phone_e164 = ?,
      status = 'completed', verified_at = ?
     WHERE id = ?`
  ).run(emailNorm, phoneE164, emailNorm, phoneE164, now, params.claimId);

  db.prepare(`UPDATE players SET status = 'winner_claimed', pending_claim_id = NULL WHERE id = ?`).run(
    player.id
  );

  auditLog("claim_complete", claim.campaign_id, player.id, { claimId: params.claimId });

  if (prize) {
    notifyWinner({
      prizeLabel: prize.label,
      kernelId: claim.kernel_id,
      claimId: params.claimId,
    })
      .then(() => {
        db.prepare(`UPDATE claims SET notified_at = ? WHERE id = ?`).run(
          new Date().toISOString(),
          params.claimId
        );
      })
      .catch((err) => {
        console.error("[notify-winner] failed", err instanceof Error ? err.message : err);
      });
  }

  return { ok: true, claimId: params.claimId };
}

export function getKernelState(campaignId: string) {
  const db = getDb();
  const claimed = db
    .prepare(
      `SELECT id, row, col, status FROM kernels
       WHERE campaign_id = ? AND status = 'claimed'`
    )
    .all(campaignId) as Pick<KernelRow, "id" | "row" | "col" | "status">[];

  const campaign = db
    .prepare(`SELECT * FROM campaigns WHERE id = ?`)
    .get(campaignId) as CampaignRow | undefined;

  return { campaign, claimedKernelIds: claimed.map((k) => k.id), claimed };
}

export function getPlayerState(sessionToken: string) {
  const db = getDb();
  const player = db
    .prepare(`SELECT * FROM players WHERE session_token = ?`)
    .get(sessionToken) as PlayerRow | undefined;

  return player ?? null;
}

export function getKernelsForCampaign(campaignId: string): KernelRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM kernels WHERE campaign_id = ? AND active = 1 ORDER BY row, col`
    )
    .all(campaignId) as KernelRow[];
}

export function getClaimsForCampaign(campaignId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT c.*, p.label as prize_label, k.row, k.col
       FROM claims c
       LEFT JOIN prizes p ON c.prize_id = p.id
       LEFT JOIN kernels k ON c.kernel_id = k.id
       WHERE c.campaign_id = ?
       ORDER BY c.created_at DESC`
    )
    .all(campaignId);
}

export function getPrizesForCampaign(campaignId: string): PrizeRow[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM prizes WHERE campaign_id = ?`)
    .all(campaignId) as PrizeRow[];
}
