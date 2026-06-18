"use client";

import { useMemo } from "react";
import {
  GRID_COLS,
  GRID_ROWS,
  KERNEL_WIDTH,
  KERNEL_HEIGHT,
  KERNEL_BORDER_RADIUS,
} from "@/lib/config";

export type KernelCell = {
  id: string;
  row: number;
  col: number;
  active: boolean;
  status: string;
  color: string;
};

/** @deprecated Use KernelCell */
export type KernelData = KernelCell;

type Props = {
  kernels: KernelCell[];
  claimedIds: Set<string>;
  disabled: boolean;
  loadingId: string | null;
  onKernelClick: (kernelId: string) => void;
};

export function CornGrid({
  kernels,
  claimedIds,
  disabled,
  loadingId,
  onKernelClick,
}: Props) {
  const activeKernels = useMemo(
    () => kernels.filter((k) => k.active),
    [kernels]
  );

  return (
    <div
      className="corn-stage"
      style={
        {
          "--cols": GRID_COLS,
          "--rows": GRID_ROWS,
          "--kw": `${KERNEL_WIDTH}px`,
          "--kh": `${KERNEL_HEIGHT}px`,
          "--radius": `${KERNEL_BORDER_RADIUS}px`,
        } as React.CSSProperties
      }
    >
      <div
        className="corn-grid"
        role="grid"
        aria-label="Corn kernel game board"
      >
        {activeKernels.map((kernel) => {
          const isClaimed = claimedIds.has(kernel.id) || kernel.status === "claimed";
          const isLoading = loadingId === kernel.id;
          const isDisabled = disabled || isClaimed || isLoading;

          return (
            <button
              key={kernel.id}
              type="button"
              role="gridcell"
              className="corn-kernel"
              style={{
                gridRow: kernel.row + 1,
                gridColumn: kernel.col + 1,
                backgroundColor: isClaimed ? "#4a3728" : kernel.color,
                opacity: isClaimed ? 0.85 : 1,
              }}
              disabled={isDisabled}
              aria-disabled={isDisabled}
              aria-label={
                isClaimed
                  ? `Kernel row ${kernel.row + 1} column ${kernel.col + 1}, claimed`
                  : `Kernel row ${kernel.row + 1} column ${kernel.col + 1}`
              }
              onClick={() => !isDisabled && onKernelClick(kernel.id)}
            >
              {isLoading && <span className="corn-kernel-spinner" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
