import { randomUUID } from "crypto";
import { getDb, auditLog } from "./db";
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

export function seedCampaign(options?: {
  name?: string;
  startsAt?: string;
  endsAt?: string;
  seed?: number;
  campaignId?: string;
}): string {
  const db = getDb();
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

  const existing = db.prepare(`SELECT id FROM campaigns WHERE id = ?`).get(campaignId);
  if (existing) {
    return campaignId;
  }

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO campaigns (id, name, starts_at, ends_at, status, seed, total_kernels, active_kernel_count)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
    ).run(campaignId, name, startsAt, endsAt, seed, totalKernels, activeCount);

    const prizeIds: string[] = [];
    for (const tier of PRIZE_TIERS) {
      const prizeId = randomUUID();
      prizeIds.push(prizeId);
      db.prepare(
        `INSERT INTO prizes (id, campaign_id, label, tier, quantity_total, quantity_remaining)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(prizeId, campaignId, tier.label, tier.tier, tier.quantity, tier.quantity);
    }

    const activeCells: { row: number; col: number }[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const active = isKernelActive(row, col) ? 1 : 0;
        const color = kernelColor(row, col, seed);
        const id = kernelId(campaignId, row, col);
        db.prepare(
          `INSERT INTO kernels (id, campaign_id, row, col, active, color, status)
           VALUES (?, ?, ?, ?, ?, ?, 'available')`
        ).run(id, campaignId, row, col, active, color);
        if (active) activeCells.push({ row, col });
      }
    }

    const shuffled = shuffle(activeCells, seed);
    const totalPrizes = PRIZE_TIERS.reduce((s, t) => s + t.quantity, 0);
    const winningCells = shuffled.slice(0, totalPrizes);

    let cellIndex = 0;
    for (let t = 0; t < PRIZE_TIERS.length; t++) {
      const prizeId = prizeIds[t];
      const qty = PRIZE_TIERS[t].quantity;
      for (let i = 0; i < qty; i++) {
        const cell = winningCells[cellIndex++];
        const id = kernelId(campaignId, cell.row, cell.col);
        db.prepare(`UPDATE kernels SET prize_id = ? WHERE id = ?`).run(prizeId, id);
      }
    }

    auditLog("campaign_seeded", campaignId, "seed", {
      seed,
      activeKernels: activeCount,
      prizes: PRIZE_TIERS,
    });
  });

  tx();
  return campaignId;
}
