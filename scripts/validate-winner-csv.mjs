import { readFileSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { createClient } = require("@libsql/client");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath =
  process.argv[2] ??
  "C:/Users/Zack/Downloads/azzip-corn-winners.csv";

for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = [];
    let cur = "";
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cols.push(cur);
    const row = {};
    header.forEach((h, idx) => {
      row[h.replace(/"/g, "")] = cols[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

const csvRows = parseCsv(readFileSync(csvPath, "utf8"));
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const dbRows = await client.execute({
  sql: `SELECT c.id, c.email, c.phone_e164, c.notified_at, COALESCE(c.voided, 0) as voided,
               p.label as prize_label
        FROM claims c
        LEFT JOIN prizes p ON c.prize_id = p.id
        WHERE c.outcome = 'win' AND c.status = 'completed'
        ORDER BY c.verified_at DESC`,
  args: [],
});

const dbById = new Map(dbRows.rows.map((r) => [String(r.id), r]));
let mismatches = 0;

console.log("CSV:", csvPath, "rows:", csvRows.length);
console.log("DB completed winners:", dbRows.rows.length);

for (const row of csvRows) {
  const db = dbById.get(row.claim_id);
  if (!db) {
    console.error("MISSING IN DB:", row.claim_id, row.email);
    mismatches++;
    continue;
  }
  if (String(db.email).toLowerCase() !== String(row.email).toLowerCase()) {
    console.error("EMAIL MISMATCH:", row.claim_id, "csv=", row.email, "db=", db.email);
    mismatches++;
  }
  if (String(db.prize_label) !== String(row.prize)) {
    console.error("PRIZE MISMATCH:", row.claim_id, "csv=", row.prize, "db=", db.prize_label);
    mismatches++;
  }
  if (String(row.voided) === "1" && !db.voided) {
    console.error("VOID MISMATCH:", row.claim_id);
    mismatches++;
  }
}

const csvIds = new Set(csvRows.map((r) => r.claim_id));
let extraDb = 0;
for (const row of dbRows.rows) {
  if (!csvIds.has(String(row.id))) {
    console.warn("EXTRA IN DB (not in CSV):", row.id, row.email);
    extraDb++;
  }
}

const csvPending = csvRows.filter((r) => {
  const db = dbById.get(r.claim_id);
  return db && !db.voided && !db.notified_at;
}).length;
const csvSent = csvRows.filter((r) => {
  const db = dbById.get(r.claim_id);
  return db && !db.voided && db.notified_at;
}).length;

console.log("\nSummary (CSV winners only):");
console.log("  Pending notification:", csvPending);
console.log("  Already notified:", csvSent);
console.log("  Row mismatches:", mismatches);
console.log("  Extra DB-only rows:", extraDb);

if (mismatches > 0) {
  process.exit(1);
}
console.log("\nOK: CSV matches database for all listed winners.");
console.log("Use /admin/winner-emails to preview and send.");
