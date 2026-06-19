import { GRID_COLS, GRID_ROWS } from "./config";

/** Insets from grid edge to ellipse — tuned for ~1250 playable kernels at 58×29. */
const COB_RADIUS_INSET_X = 0.5;
const COB_RADIUS_INSET_Y = 0.5;

/** Elliptical corn-cob silhouette — only active cells are clickable. */
export function isKernelActive(row: number, col: number): boolean {
  const centerCol = (GRID_COLS - 1) / 2;
  const centerRow = (GRID_ROWS - 1) / 2;
  const radiusX = GRID_COLS / 2 - COB_RADIUS_INSET_X;
  const radiusY = GRID_ROWS / 2 - COB_RADIUS_INSET_Y;
  const dx = (col - centerCol) / radiusX;
  const dy = (row - centerRow) / radiusY;
  return dx * dx + dy * dy <= 1;
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
