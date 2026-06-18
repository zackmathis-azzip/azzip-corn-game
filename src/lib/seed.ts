import { randomUUID } from "crypto";
import { auditLog, sqlBatch, sqlGet, sqlRun } from "./db";
import { GRID_COLS, GRID_ROWS, PRIZE_TIERS } from "./config";
import { isKernelActive, countActiveKernels } from "./cob-mask";
import { kernelColor, kernelId } from "./kernel-colors";

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 15), 1 | s);
    s = (s + Math.imul(s ^ (s >>> 7), 61 | s)) ^ s;
    const j = (s >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function seedCampaign(options?: {
  name?: string;
  startsAt?: string;
  endsAt?: string;
  seed?: number;
  campaignId?: string;
}): Promise<string> {
  const campaignId = options?.campaignId ?? randomUUID();
  const seed = options?.seed ?? Math.floor(Math.random() * 1_000_000);
  const name = options?.name ?? "Azzip Corn Kernel Game 2026";
  const startsAt =
    options?.startsAt ??
    process.env.CAMPAIGN_STARTS_AT ??
    new Date().toISOString();
  const endsAt =
    options?.endsAt ??
    process.env.CAMPAIGN_ENDS_AT ??
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const totalKernels = GRID_COLS * GRID_ROWS;
  const activeCount = countActiveKernels();

  const existing = await sqlGet<{ id: string }>(
    `SELECT id FROM campaigns WHERE id = ?`,
    [campaignId]
  );
  if (existing) {
    return campaignId;
  }

  await sqlRun(
    `INSERT INTO campaigns (id, name, starts_at, ends_at, status, seed, total_kernels, active_kernel_count)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
    [campaignId, name, startsAt, endsAt, seed, totalKernels, activeCount]
  );

  const prizeIds: string[] = [];
  const prizeStatements: Array<{ sql: string; args: (string | number)[] }> = [];
  for (const tier of PRIZE_TIERS) {
    const prizeId = randomUUID();
    prizeIds.push(prizeId);
    prizeStatements.push({
      sql: `INSERT INTO prizes (id, campaign_id, label, tier, quantity_total, quantity_remaining)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [prizeId, campaignId, tier.label, tier.tier, tier.quantity, tier.quantity],
    });
  }
  await sqlBatch(prizeStatements);

  const activeCells: { row: number; col: number }[] = [];
  const kernelStatements: Array<{ sql: string; args: (string | number)[] }> = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const active = isKernelActive(row, col) ? 1 : 0;
      const color = kernelColor(row, col, seed);
      const id = kernelId(campaignId, row, col);
      kernelStatements.push({
        sql: `INSERT INTO kernels (id, campaign_id, row, col, active, color, status)
              VALUES (?, ?, ?, ?, ?, ?, 'available')`,
        args: [id, campaignId, row, col, active, color],
      });
      if (active) activeCells.push({ row, col });
    }
  }

  const CHUNK = 200;
  for (let i = 0; i < kernelStatements.length; i += CHUNK) {
    await sqlBatch(kernelStatements.slice(i, i + CHUNK));
  }

  const shuffled = shuffle(activeCells, seed);
  const totalPrizes = PRIZE_TIERS.reduce((s, t) => s + t.quantity, 0);
  const winningCells = shuffled.slice(0, totalPrizes);

  const prizeUpdates: Array<{ sql: string; args: string[] }> = [];
  let cellIndex = 0;
  for (let t = 0; t < PRIZE_TIERS.length; t++) {
    const prizeId = prizeIds[t];
    const qty = PRIZE_TIERS[t].quantity;
    for (let i = 0; i < qty; i++) {
      const cell = winningCells[cellIndex++];
      const id = kernelId(campaignId, cell.row, cell.col);
      prizeUpdates.push({
        sql: `UPDATE kernels SET prize_id = ? WHERE id = ?`,
        args: [prizeId, id],
      });
    }
  }
  await sqlBatch(prizeUpdates);

  await auditLog("campaign_seeded", campaignId, "seed", {
    seed,
    activeKernels: activeCount,
    prizes: PRIZE_TIERS,
  });

  return campaignId;
}
