export const GRID_COLS = 53;
export const GRID_ROWS = 24;
export const KERNEL_WIDTH = 36;
export const KERNEL_HEIGHT = 45;
export const KERNEL_BORDER_RADIUS = 9;
export const GRID_WIDTH = GRID_COLS * KERNEL_WIDTH; // 1908
export const GRID_HEIGHT = GRID_ROWS * KERNEL_HEIGHT; // 1080

export const DESKTOP_ARTBOARD = { width: 1920, height: 1080 };
export const MOBILE_ARTBOARD = { width: 1080, height: 1920 };

export const POLL_INTERVAL_MS = 2500;

export const PRIZE_TIERS = [
  { tier: "elote", label: "Free Love It Elote", quantity: 25 },
  { tier: "five_off", label: "$5 Off", quantity: 25 },
] as const;

export const TOTAL_PRIZES = PRIZE_TIERS.reduce((sum, p) => sum + p.quantity, 0);

export const FULFILLMENT_EMAIL =
  process.env.FULFILLMENT_EMAIL ?? "zack.mathis@azzippizza.com";

export const SESSION_COOKIE = "player_session";
export const ADMIN_COOKIE = "admin_auth";

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 30;

/** Soft cap: max kernel claims per IP per rolling 24h (office-friendly, not unlimited). */
export const IP_PLAY_LIMIT = 20;
export const IP_PLAY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Unclaimed instant-win hold time before kernel + prize return to the pool (production). */
export const UNCLAIMED_WIN_TIMEOUT_MS =
  Math.max(1, Number(process.env.UNCLAIMED_WIN_TIMEOUT_MINUTES ?? 30)) * 60 * 1000;

export const SPONSOR_AZZIP_LOGO_URL =
  "https://azzippizza.com/wp-content/themes/azzip/assets/img/logo-alt.svg";
/** Wordmark with keyed transparency (scripts/process-old-major-wordmark.mjs) */
export const SPONSOR_OLD_MAJOR_LOGO_URL = "/sponsors/old-major-wordmark.png";

/** Server-only: allow unlimited plays per session for QA (never enable in production). */
export function devAllowReplay(): boolean {
  const value = process.env.DEV_ALLOW_REPLAY?.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  // Local `npm run dev` — on by default unless explicitly disabled above.
  return process.env.NODE_ENV === "development";
}
