import { GRID_COLS, GRID_ROWS } from "./config";

/** Elliptical corn-cob silhouette — only active cells are clickable. */
export function isKernelActive(row: number, col: number): boolean {
  const centerCol = (GRID_COLS - 1) / 2;
  const centerRow = (GRID_ROWS - 1) / 2;
  const radiusX = GRID_COLS / 2 - 1.5;
  const radiusY = GRID_ROWS / 2 - 1;
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
