import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "corn-game.db");

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  seed INTEGER NOT NULL,
  total_kernels INTEGER NOT NULL,
  active_kernel_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prizes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  label TEXT NOT NULL,
  tier TEXT NOT NULL,
  quantity_total INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS kernels (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  row INTEGER NOT NULL,
  col INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  prize_id TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  color TEXT NOT NULL,
  claimed_at TEXT,
  claimed_by_player_id TEXT,
  UNIQUE(campaign_id, row, col),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL,
  first_click_at TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  pending_claim_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  kernel_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  prize_id TEXT,
  outcome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  email TEXT,
  phone TEXT,
  email_normalized TEXT,
  phone_e164 TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at TEXT,
  notified_at TEXT,
  voided INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (kernel_id) REFERENCES kernels(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_claims_email_win
  ON claims(email_normalized) WHERE outcome = 'win' AND status = 'completed';

CREATE INDEX IF NOT EXISTS idx_claims_phone_win
  ON claims(phone_e164) WHERE outcome = 'win' AND status = 'completed';

CREATE INDEX IF NOT EXISTS idx_kernels_campaign_status
  ON kernels(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_players_session
  ON players(session_token);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  action TEXT NOT NULL,
  actor TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export type CampaignRow = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  seed: number;
  total_kernels: number;
  active_kernel_count: number;
  created_at: string;
};

export type KernelRow = {
  id: string;
  campaign_id: string;
  row: number;
  col: number;
  active: number;
  prize_id: string | null;
  status: string;
  color: string;
  claimed_at: string | null;
  claimed_by_player_id: string | null;
};

export type PlayerRow = {
  id: string;
  session_token: string;
  campaign_id: string;
  first_click_at: string | null;
  status: string;
  pending_claim_id: string | null;
  created_at: string;
};

export type ClaimRow = {
  id: string;
  campaign_id: string;
  kernel_id: string;
  player_id: string;
  prize_id: string | null;
  outcome: string;
  status: string;
  email: string | null;
  phone: string | null;
  email_normalized: string | null;
  phone_e164: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  verified_at: string | null;
  notified_at: string | null;
};

export type PrizeRow = {
  id: string;
  campaign_id: string;
  label: string;
  tier: string;
  quantity_total: number;
  quantity_remaining: number;
};

export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

function migrate(database: Database.Database) {
  const cols = database
    .prepare(`PRAGMA table_info(claims)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "voided")) {
    database.exec(`ALTER TABLE claims ADD COLUMN voided INTEGER NOT NULL DEFAULT 0`);
  }
}

export function auditLog(
  action: string,
  campaignId: string | null,
  actor: string,
  details?: Record<string, unknown>
): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO audit_log (id, campaign_id, action, actor, details) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      campaignId,
      action,
      actor,
      details ? JSON.stringify(details) : null
    );
}

export function getActiveCampaign(): CampaignRow | undefined {
  const database = getDb();
  const envId = process.env.CAMPAIGN_ID;
  if (envId) {
    return database.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(envId) as
      | CampaignRow
      | undefined;
  }
  return database
    .prepare(
      `SELECT * FROM campaigns WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
    )
    .get() as CampaignRow | undefined;
}

export function isCampaignPlayable(campaign: CampaignRow): {
  playable: boolean;
  reason?: string;
} {
  if (campaign.status === "paused") {
    return { playable: false, reason: "campaign_paused" };
  }
  if (campaign.status === "ended") {
    return { playable: false, reason: "campaign_ended" };
  }
  const now = new Date();
  const starts = new Date(campaign.starts_at);
  const ends = new Date(campaign.ends_at);
  if (now < starts) return { playable: false, reason: "campaign_not_started" };
  if (now > ends) return { playable: false, reason: "campaign_ended" };
  return { playable: true };
}
