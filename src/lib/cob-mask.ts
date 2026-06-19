import { GRID_COLS, GRID_ROWS } from "./config";

/** Centered elongated oval — tuned for ~1,250 playable kernels at 67×29. */
const COB_RADIUS_INSET_X = 1.1;
const COB_RADIUS_INSET_Y = 2.26;
const COB_SHAPE_EXPONENT = 2;

const MAX_BACK_HUSK = 4;
const MAX_EDGE_HUSK = 3;
const HUSK_ARC_REACH = 0.38;

function cobRadii() {
  return {
    centerCol: (GRID_COLS - 1) / 2,
    centerRow: (GRID_ROWS - 1) / 2,
    radiusX: GRID_COLS / 2 - COB_RADIUS_INSET_X,
    radiusY: GRID_ROWS / 2 - COB_RADIUS_INSET_Y,
  };
}

function cobMetric(row: number, col: number): number {
  const { centerCol, centerRow, radiusX, radiusY } = cobRadii();
  const dx = (col - centerCol) / radiusX;
  const dy = (row - centerRow) / radiusY;
  return (
    Math.pow(Math.abs(dx), COB_SHAPE_EXPONENT) + Math.pow(Math.abs(dy), COB_SHAPE_EXPONENT)
  );
}

function normalizedX(col: number): number {
  const { centerCol, radiusX } = cobRadii();
  return (col - centerCol) / radiusX;
}

function rowFill(row: number): number {
  const { centerRow, radiusY } = cobRadii();
  const dist = Math.abs(row - centerRow) / radiusY;
  return Math.max(0, 1 - Math.pow(dist, 1.25));
}

/** Long oval cob — symmetric rounded ends. */
export function isKernelActive(row: number, col: number): boolean {
  return cobMetric(row, col) <= 1;
}

function cobLeftEdgeCol(row: number): number | null {
  for (let col = 0; col < GRID_COLS; col++) {
    if (isKernelActive(row, col)) return col;
  }
  return null;
}

function cobRightEdgeCol(row: number): number | null {
  for (let col = GRID_COLS - 1; col >= 0; col--) {
    if (isKernelActive(row, col)) return col;
  }
  return null;
}

function cobTopEdgeRow(col: number): number | null {
  for (let row = 0; row < GRID_ROWS; row++) {
    if (isKernelActive(row, col)) return row;
  }
  return null;
}

function cobBottomEdgeRow(col: number): number | null {
  for (let row = GRID_ROWS - 1; row >= 0; row--) {
    if (isKernelActive(row, col)) return row;
  }
  return null;
}

export type HuskLeaf = "back" | "top" | "bottom";
export type HuskSide = "desktop" | "mobile";

export type HuskCell = {
  row: number;
  col: number;
  depth: number;
  leaf: HuskLeaf;
  side: HuskSide;
};

function inLeftHuskArc(col: number): boolean {
  return normalizedX(col) <= HUSK_ARC_REACH;
}

function inRightHuskArc(col: number): boolean {
  return normalizedX(col) >= -HUSK_ARC_REACH;
}

function leftBackHuskDepth(row: number, col: number): number {
  if (isKernelActive(row, col) || !inLeftHuskArc(col)) return 0;
  const left = cobLeftEdgeCol(row);
  if (left === null || col >= left) return 0;
  const depth = left - col;
  const maxDepth = Math.max(1, Math.round(MAX_BACK_HUSK * rowFill(row)));
  if (depth < 1 || depth > maxDepth) return 0;
  return depth;
}

function rightBackHuskDepth(row: number, col: number): number {
  if (isKernelActive(row, col) || !inRightHuskArc(col)) return 0;
  const right = cobRightEdgeCol(row);
  if (right === null || col <= right) return 0;
  const depth = col - right;
  const maxDepth = Math.max(1, Math.round(MAX_BACK_HUSK * rowFill(row)));
  if (depth < 1 || depth > maxDepth) return 0;
  return depth;
}

function topHuskDepth(row: number, col: number, arc: "left" | "right"): number {
  if (isKernelActive(row, col)) return 0;
  if (arc === "left" ? !inLeftHuskArc(col) : !inRightHuskArc(col)) return 0;
  const top = cobTopEdgeRow(col);
  if (top === null) return 0;
  const depth = top - row;
  if (depth < 1 || depth > MAX_EDGE_HUSK) return 0;
  return depth;
}

function bottomHuskDepth(row: number, col: number, arc: "left" | "right"): number {
  if (isKernelActive(row, col)) return 0;
  if (arc === "left" ? !inLeftHuskArc(col) : !inRightHuskArc(col)) return 0;
  const bottom = cobBottomEdgeRow(col);
  if (bottom === null) return 0;
  const depth = row - bottom;
  if (depth < 1 || depth > MAX_EDGE_HUSK) return 0;
  return depth;
}

/** Desktop: left arc. Mobile (90° canvas): right arc → screen bottom. */
export function getHuskCells(side: HuskSide): HuskCell[] {
  const arc = side === "desktop" ? "left" : "right";
  const cells: HuskCell[] = [];
  const seen = new Set<string>();

  const add = (row: number, col: number, depth: number, leaf: HuskLeaf) => {
    const key = `${row},${col}`;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push({ row, col, depth, leaf, side });
  };

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const back =
        arc === "left" ? leftBackHuskDepth(row, col) : rightBackHuskDepth(row, col);
      if (back > 0) add(row, col, back, "back");

      const top = topHuskDepth(row, col, arc);
      if (top > 0) add(row, col, top, "top");

      const bottom = bottomHuskDepth(row, col, arc);
      if (bottom > 0) add(row, col, bottom, "bottom");
    }
  }

  return cells;
}

export function countActiveKernels(): number {
  let count = 0;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (isKernelActive(row, col)) count++;
    }
  }
  return count;
}
