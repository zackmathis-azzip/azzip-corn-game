import { randomUUID } from "crypto";
import {
  auditLog,
  getActiveCampaign,
  isCampaignPlayable,
  sqlAll,
  sqlGet,
  sqlRun,
  withTransaction,
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

export async function getOrCreatePlayer(
  sessionToken: string,
  campaignId: string
): Promise<PlayerRow> {
  const existing = await sqlGet<PlayerRow>(
    `SELECT * FROM players WHERE session_token = ?`,
    [sessionToken]
  );

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

  await sqlRun(
    `INSERT INTO players (id, session_token, campaign_id, status, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [player.id, player.session_token, player.campaign_id, player.status, player.created_at]
  );

  return player;
}

export async function claimKernel(params: {
  kernelId: string;
  sessionToken: string;
  ip: string;
  userAgent: string;
}): Promise<ClaimResult> {
  const campaign = await getActiveCampaign();
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

  const player = await getOrCreatePlayer(params.sessionToken, campaign.id);

  if (player.status !== "new") {
    return {
      ok: false,
      error: "already_played",
      message: "You have already played. One play per person.",
    };
  }

  const kernel = await sqlGet<KernelRow>(
    `SELECT * FROM kernels WHERE id = ? AND campaign_id = ?`,
    [params.kernelId, campaign.id]
  );

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

  const result = await withTransaction(async (tx) => {
    const update = await tx.run(
      `UPDATE kernels
       SET status = 'claimed', claimed_at = ?, claimed_by_player_id = ?
       WHERE id = ? AND status = 'available'`,
      [now, player.id, params.kernelId]
    );

    if (update.rowsAffected === 0) {
      return { race: true as const };
    }

    let prize: PrizeRow | undefined;
    if (kernel.prize_id) {
      prize = await tx.get<PrizeRow>(
        `SELECT * FROM prizes WHERE id = ? AND quantity_remaining > 0`,
        [kernel.prize_id]
      );

      if (prize) {
        const dec = await tx.run(
          `UPDATE prizes SET quantity_remaining = quantity_remaining - 1
           WHERE id = ? AND quantity_remaining > 0`,
          [kernel.prize_id]
        );
        if (dec.rowsAffected === 0) {
          prize = undefined;
        }
      }
    }

    const isWin = Boolean(prize);
    const outcome = isWin ? "win" : "lose";
    const status = isWin ? "pending" : "completed";

    await tx.run(
      `INSERT INTO claims (
        id, campaign_id, kernel_id, player_id, prize_id, outcome, status,
        ip, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        claimId,
        campaign.id,
        params.kernelId,
        player.id,
        prize?.id ?? null,
        outcome,
        status,
        params.ip,
        params.userAgent,
        now,
      ]
    );

    const playerStatus = isWin ? "winner_pending" : "finished";
    await tx.run(
      `UPDATE players SET status = ?, first_click_at = ?, pending_claim_id = ? WHERE id = ?`,
      [playerStatus, now, isWin ? claimId : null, player.id]
    );

    return { race: false as const, isWin, prize };
  });

  if (result.race) {
    return {
      ok: false,
      error: "kernel_taken",
      message: "This kernel was just claimed. Try another!",
    };
  }

  await auditLog("kernel_claim", campaign.id, player.id, {
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

export async function completeClaim(params: {
  claimId: string;
  sessionToken: string;
  email: string;
  phone: string;
  consent: boolean;
  ip: string;
  userAgent: string;
}): Promise<CompleteClaimResult> {
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

  const player = await sqlGet<PlayerRow>(
    `SELECT * FROM players WHERE session_token = ?`,
    [params.sessionToken]
  );

  if (!player || player.status !== "winner_pending" || player.pending_claim_id !== params.claimId) {
    return { ok: false, error: "invalid_claim", message: "Invalid or expired claim." };
  }

  const claim = await sqlGet<ClaimRow>(
    `SELECT * FROM claims WHERE id = ? AND player_id = ? AND status = 'pending'`,
    [params.claimId, player.id]
  );

  if (!claim) {
    return { ok: false, error: "invalid_claim", message: "Claim not found." };
  }

  const dupEmail = await sqlGet<{ id: string }>(
    `SELECT id FROM claims
     WHERE email_normalized = ? AND outcome = 'win' AND status = 'completed' AND id != ?`,
    [emailNorm, params.claimId]
  );

  if (dupEmail) {
    return {
      ok: false,
      error: "duplicate_identity",
      message: "This email has already won a prize in this promotion.",
    };
  }

  const dupPhone = await sqlGet<{ id: string }>(
    `SELECT id FROM claims
     WHERE phone_e164 = ? AND outcome = 'win' AND status = 'completed' AND id != ?`,
    [phoneE164, params.claimId]
  );

  if (dupPhone) {
    return {
      ok: false,
      error: "duplicate_identity",
      message: "This phone number has already won a prize in this promotion.",
    };
  }

  const now = new Date().toISOString();
  const prize = claim.prize_id
    ? await sqlGet<PrizeRow>(`SELECT * FROM prizes WHERE id = ?`, [claim.prize_id])
    : null;

  await sqlRun(
    `UPDATE claims SET
      email = ?, phone = ?, email_normalized = ?, phone_e164 = ?,
      status = 'completed', verified_at = ?
     WHERE id = ?`,
    [emailNorm, phoneE164, emailNorm, phoneE164, now, params.claimId]
  );

  await sqlRun(
    `UPDATE players SET status = 'winner_claimed', pending_claim_id = NULL WHERE id = ?`,
    [player.id]
  );

  await auditLog("claim_complete", claim.campaign_id, player.id, { claimId: params.claimId });

  if (prize) {
    notifyWinner({
      prizeLabel: prize.label,
      kernelId: claim.kernel_id,
      claimId: params.claimId,
    })
      .then(() =>
        sqlRun(`UPDATE claims SET notified_at = ? WHERE id = ?`, [
          new Date().toISOString(),
          params.claimId,
        ])
      )
      .catch((err) => {
        console.error("[notify-winner] failed", err instanceof Error ? err.message : err);
      });
  }

  return { ok: true, claimId: params.claimId };
}

export async function getKernelState(campaignId: string) {
  const claimed = await sqlAll<Pick<KernelRow, "id" | "row" | "col" | "status">>(
    `SELECT id, row, col, status FROM kernels
     WHERE campaign_id = ? AND status = 'claimed'`,
    [campaignId]
  );

  const campaign = await sqlGet<CampaignRow>(
    `SELECT * FROM campaigns WHERE id = ?`,
    [campaignId]
  );

  return { campaign, claimedKernelIds: claimed.map((k) => k.id), claimed };
}

export async function getPlayerState(sessionToken: string) {
  const player = await sqlGet<PlayerRow>(
    `SELECT * FROM players WHERE session_token = ?`,
    [sessionToken]
  );
  return player ?? null;
}

export async function getKernelsForCampaign(campaignId: string): Promise<KernelRow[]> {
  return sqlAll<KernelRow>(
    `SELECT * FROM kernels WHERE campaign_id = ? AND active = 1 ORDER BY row, col`,
    [campaignId]
  );
}

export async function getClaimsForCampaign(campaignId: string) {
  return sqlAll(
    `SELECT c.*, p.label as prize_label, k.row, k.col
     FROM claims c
     LEFT JOIN prizes p ON c.prize_id = p.id
     LEFT JOIN kernels k ON c.kernel_id = k.id
     WHERE c.campaign_id = ?
     ORDER BY c.created_at DESC`,
    [campaignId]
  );
}

export async function getPrizesForCampaign(campaignId: string): Promise<PrizeRow[]> {
  return sqlAll<PrizeRow>(`SELECT * FROM prizes WHERE campaign_id = ?`, [campaignId]);
}
