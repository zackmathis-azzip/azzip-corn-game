"use client";

import { useMemo } from "react";
import {
  GRID_COLS,
  GRID_ROWS,
  KERNEL_WIDTH,
  KERNEL_HEIGHT,
  KERNEL_BORDER_RADIUS,
  SPONSOR_AZZIP_LOGO_URL,
  SPONSOR_OLD_MAJOR_LOGO_URL,
} from "@/lib/config";
import { getHuskCells } from "@/lib/cob-mask";
import { huskColor } from "@/lib/kernel-colors";

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
  /** Clicking any green husk fires this (no prize, infinitely reusable) */
  onHuskClick?: () => void;
  /** Campaign seed for stable husk shading */
  campaignSeed?: number;
  /** Dev only: render every kernel as claimed for layout preview */
  previewAllClaimed?: boolean;
};

export function CornGrid({
  kernels,
  claimedIds,
  disabled,
  loadingId,
  onKernelClick,
  onHuskClick,
  campaignSeed = 0,
  previewAllClaimed = false,
}: Props) {
  const activeKernels = useMemo(
    () => kernels.filter((k) => k.active),
    [kernels]
  );
  const huskDesktop = useMemo(() => getHuskCells("desktop"), []);
  const huskMobile = useMemo(() => getHuskCells("mobile"), []);

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
      <div className="corn-canvas">
        <div className="corn-sponsors" aria-hidden>
          <div className="corn-sponsor-slot corn-sponsor-slot--azzip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="corn-sponsor-logo corn-sponsor-logo--azzip"
              src={SPONSOR_AZZIP_LOGO_URL}
              alt=""
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="corn-sponsor-x">×</span>
          <div className="corn-sponsor-slot corn-sponsor-slot--old-major">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="corn-sponsor-logo corn-sponsor-logo--old-major"
              src={SPONSOR_OLD_MAJOR_LOGO_URL}
              alt=""
            />
          </div>
        </div>
        <div className="corn-grid" role="grid" aria-label="Corn kernel game board">
          {huskDesktop.map((husk) => (
            <button
              key={`husk-d-${husk.leaf}-${husk.row}-${husk.col}`}
              type="button"
              className={`corn-husk corn-husk-set--desktop corn-husk--${husk.leaf} corn-husk--depth-${husk.depth}`}
              style={{
                gridRow: husk.row + 1,
                gridColumn: husk.col + 1,
                backgroundColor: huskColor(husk.row, husk.col, campaignSeed),
              }}
              aria-label="Corn husk"
              onClick={onHuskClick}
            />
          ))}
          {huskMobile.map((husk) => (
            <button
              key={`husk-m-${husk.leaf}-${husk.row}-${husk.col}`}
              type="button"
              className={`corn-husk corn-husk-set--mobile corn-husk--${husk.leaf} corn-husk--depth-${husk.depth}`}
              style={{
                gridRow: husk.row + 1,
                gridColumn: husk.col + 1,
                backgroundColor: huskColor(husk.row, husk.col, campaignSeed),
              }}
              aria-label="Corn husk"
              onClick={onHuskClick}
            />
          ))}
          {activeKernels.map((kernel) => {
            const isClaimed =
              previewAllClaimed || claimedIds.has(kernel.id) || kernel.status === "claimed";
            const isLoading = !previewAllClaimed && loadingId === kernel.id;
            const isDisabled = disabled || isClaimed || isLoading;

            return (
              <button
                key={kernel.id}
                type="button"
                role="gridcell"
                className={`corn-kernel${isClaimed ? " corn-kernel--claimed" : ""}`}
                style={{
                  gridRow: kernel.row + 1,
                  gridColumn: kernel.col + 1,
                  backgroundColor: isClaimed ? "#4a3728" : kernel.color,
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
    </div>
  );
}
