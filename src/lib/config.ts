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
