// One-off: export the launched campaign's kernel-click timeline for the canvas.
// Run with:  node --env-file=.env.local scripts/export-timeline.mjs
import { createClient } from "@libsql/client";
import fs from "fs";

const url = process.env.TURSO_DATABASE_URL ?? process.env.LIBSQL_URL;
const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.LIBSQL_AUTH_TOKEN;

if (!url) {
  console.error("Missing TURSO_DATABASE_URL / LIBSQL_URL");
  process.exit(1);
}

const db = createClient({ url, authToken });

// Pick the campaign with the most claims (the launched/played one).
const camps = await db.execute(`
  SELECT c.id, c.name, c.status, c.seed, c.starts_at, c.ends_at, c.created_at,
         (SELECT COUNT(*) FROM claims cl WHERE cl.campaign_id = c.id) AS claim_count,
         (SELECT COUNT(*) FROM kernels k WHERE k.campaign_id = c.id AND k.active = 1) AS active_count
  FROM campaigns c
  ORDER BY claim_count DESC, c.created_at DESC
`);

console.log("Campaigns:");
for (const r of camps.rows) {
  console.log(
    `  ${r.id}  "${r.name}"  status=${r.status}  active=${r.active_count}  claims=${r.claim_count}  created=${r.created_at}`
  );
}

const campaign = camps.rows[0];
if (!campaign) {
  console.error("No campaigns found.");
  process.exit(1);
}
const campaignId = campaign.id;

const kernels = await db.execute({
  sql: `SELECT row, col, prize_id, status, claimed_at
        FROM kernels
        WHERE campaign_id = ? AND active = 1`,
  args: [campaignId],
});

const prizes = await db.execute({
  sql: `SELECT id, label, tier FROM prizes WHERE campaign_id = ?`,
  args: [campaignId],
});
const prizeById = new Map(prizes.rows.map((p) => [p.id, p]));

// Completed winner claims (forms actually submitted) keyed by kernel.
const completed = await db.execute({
  sql: `SELECT kernel_id, verified_at FROM claims
        WHERE campaign_id = ? AND outcome = 'win' AND status = 'completed'`,
  args: [campaignId],
});
const completedKernels = new Set(completed.rows.map((r) => r.kernel_id));

let cols = 0;
let rows = 0;
const claimedTimes = [];
for (const k of kernels.rows) {
  cols = Math.max(cols, Number(k.col) + 1);
  rows = Math.max(rows, Number(k.row) + 1);
  if (k.claimed_at) claimedTimes.push(Date.parse(k.claimed_at));
}

const t0 = claimedTimes.length ? Math.min(...claimedTimes) : 0;
const tEnd = claimedTimes.length ? Math.max(...claimedTimes) : 0;

// kernels entry: [col, row, flags, tSec]
//   flags bit0 = prize spot, bit1 = completed (form submitted)
//   tSec   = seconds from first claim, or -1 if never claimed (still available)
const kernelData = kernels.rows.map((k) => {
  const isPrize = k.prize_id != null ? 1 : 0;
  const kernelId = `${campaignId}:${k.row}:${k.col}`;
  // kernel id format check below; fall back to status/claimed
  const completedFlag = 0; // resolved after we know the id format
  const tSec =
    k.claimed_at != null ? Math.round((Date.parse(k.claimed_at) - t0) / 1000) : -1;
  return { col: Number(k.col), row: Number(k.row), isPrize, completedFlag, tSec, kernelId };
});

// Resolve completed flag using actual claim kernel_ids (id format may differ).
// Build a lookup of "row,col" -> completed by matching kernel ids we can parse,
// else match by claimed kernels intersected with completed set via a join query.
const completedByRowCol = await db.execute({
  sql: `SELECT k.row AS row, k.col AS col
        FROM claims cl JOIN kernels k ON cl.kernel_id = k.id
        WHERE cl.campaign_id = ? AND cl.outcome = 'win' AND cl.status = 'completed'`,
  args: [campaignId],
});
const completedSet = new Set(
  completedByRowCol.rows.map((r) => `${r.row},${r.col}`)
);

const data = {
  campaign: {
    id: String(campaignId),
    name: String(campaign.name),
    status: String(campaign.status),
    startedAt: t0 ? new Date(t0).toISOString() : null,
    endedAt: tEnd ? new Date(tEnd).toISOString() : null,
    durationSec: t0 && tEnd ? Math.round((tEnd - t0) / 1000) : 0,
  },
  cols,
  rows,
  totalActive: kernels.rows.length,
  totalClaimed: claimedTimes.length,
  prizeSpots: kernels.rows.filter((k) => k.prize_id != null).length,
  prizeCompleted: completedSet.size,
  kernels: kernelData.map((k) => [
    k.col,
    k.row,
    (k.isPrize ? 1 : 0) | (completedSet.has(`${k.row},${k.col}`) ? 2 : 0),
    k.tSec,
  ]),
};

fs.writeFileSync("scripts/timeline-data.json", JSON.stringify(data));
console.log("\nSummary:");
console.log(`  campaign: ${data.campaign.name} (${data.campaign.status})`);
console.log(`  grid: ${cols} x ${rows}`);
console.log(`  active kernels: ${data.totalActive}`);
console.log(`  claimed kernels: ${data.totalClaimed}`);
console.log(`  prize spots: ${data.prizeSpots}  (forms completed: ${data.prizeCompleted})`);
console.log(`  duration: ${data.campaign.durationSec}s  (${(data.campaign.durationSec / 60).toFixed(1)} min)`);
console.log(`  window: ${data.campaign.startedAt} -> ${data.campaign.endedAt}`);
console.log("\nWrote scripts/timeline-data.json");
