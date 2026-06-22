import raw from "../../scripts/timeline-data.json";

/** [col, row, flags, tSec] — flags bit0 = prize spot */
export type TimelineKernel = [col: number, row: number, flags: number, tSec: number];

export const TIMELINE_DURATION_SEC = raw.campaign.durationSec;
export const TIMELINE_STARTED_AT = raw.campaign.startedAt;
export const TIMELINE_TOTAL_ACTIVE = raw.totalActive;
export const TIMELINE_PRIZE_SPOTS = raw.prizeSpots;
export const TIMELINE_KERNELS = raw.kernels as TimelineKernel[];
