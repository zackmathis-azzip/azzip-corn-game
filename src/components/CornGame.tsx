"use client";

import { useCallback, useEffect, useState } from "react";
import { CornGrid, type KernelCell } from "./CornGrid";
import { Modal } from "./Modal";
import { WinForm } from "./WinForm";
import { POLL_INTERVAL_MS } from "@/lib/config";

type CampaignInfo = {
  id: string;
  name: string;
  status: string;
};

type ModalState =
  | { type: "none" }
  | { type: "win"; claimId: string; prizeLabel: string }
  | { type: "lose" }
  | { type: "message"; title: string; body: string };

type Props = {
  turnstileSiteKey: string | null;
};

export function CornGame({ turnstileSiteKey }: Props) {
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [kernels, setKernels] = useState<KernelCell[]>([]);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [playerStatus, setPlayerStatus] = useState<string | null>(null);
  const [prizesRemaining, setPrizesRemaining] = useState<number | null>(null);
  const [devAllowReplay, setDevAllowReplay] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mustCompleteWin = playerStatus === "winner_pending";
  const hasPlayed =
    !devAllowReplay &&
    (playerStatus === "finished" ||
      playerStatus === "winner_pending" ||
      playerStatus === "winner_claimed");
  const playBlocked = mustCompleteWin || hasPlayed;

  const refreshState = useCallback(async (campaignId: string, full = false) => {
    const url = full
      ? `/api/campaigns/${campaignId}/kernel-state`
      : `/api/campaigns/${campaignId}/kernel-state?kernels=0`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;

    const data = await res.json();
    setClaimedIds(new Set(data.claimedKernelIds as string[]));
    setPlayerStatus(data.playerStatus);
    if (typeof data.prizesRemaining === "number") {
      setPrizesRemaining(data.prizesRemaining);
    }
    if (typeof data.devAllowReplay === "boolean") {
      setDevAllowReplay(data.devAllowReplay);
    }

    if (full && data.kernels) {
      setKernels(data.kernels);
    }

    if (data.playerStatus === "winner_pending" && data.pendingClaimId) {
      setModal((m) =>
        m.type === "win"
          ? m
          : { type: "win", claimId: data.pendingClaimId, prizeLabel: "Your prize" }
      );
    }
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        const campRes = await fetch("/api/campaign/current");
        const campData = await campRes.json();
        if (!campData.campaign) {
          setError("No active promotion right now. Check back soon!");
          setBootLoading(false);
          return;
        }
        setCampaign(campData.campaign);
        await refreshState(campData.campaign.id, true);
      } catch {
        setError("Could not load the game. Please refresh.");
      } finally {
        setBootLoading(false);
      }
    }
    boot();
  }, [refreshState]);

  useEffect(() => {
    if (!campaign) return;
    const id = setInterval(() => refreshState(campaign.id, false), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [campaign, refreshState]);

  async function handleKernelClick(kernelId: string) {
    if (playBlocked || loadingId) return;

    setLoadingId(kernelId);
    setError(null);

    try {
      const res = await fetch(`/api/kernels/${encodeURIComponent(kernelId)}/claim`, {
        method: "POST",
      });
      const data = await res.json();

      if (!data.ok) {
        if (data.error === "already_played") {
          setModal({
            type: "message",
            title: "Already Played",
            body: data.message ?? "You have already played.",
          });
          setPlayerStatus("finished");
        } else if (data.error === "complete_pending_win") {
          setError(data.message ?? "Complete your prize claim before playing again.");
        } else if (data.error === "kernel_taken") {
          setError(data.message ?? "That kernel was just taken.");
          if (campaign) await refreshState(campaign.id, false);
        } else {
          setError(data.message ?? "Something went wrong.");
        }
        return;
      }

      setClaimedIds((prev) => new Set(prev).add(kernelId));

      if (data.outcome === "win") {
        setPlayerStatus("winner_pending");
        setModal({
          type: "win",
          claimId: data.claimId,
          prizeLabel: data.prizeLabel ?? "A prize",
        });
      } else {
        setPlayerStatus(devAllowReplay ? "new" : "finished");
        setModal({ type: "lose" });
      }

      if (campaign) await refreshState(campaign.id, false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  if (bootLoading) {
    return (
      <div className="play-shell">
        <p className="status-message" role="status">
          Loading corn…
        </p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="play-shell">
        <p className="status-message" role="alert">
          {error ?? "Promotion unavailable."}
        </p>
      </div>
    );
  }

  return (
    <div className="play-shell">
      <header className="play-header">
        <h1>Azzip Corn Kernel Game</h1>
        <p>Pick one kernel — one play per person!</p>
        {prizesRemaining !== null && (
          <p className="prize-counter" role="status">
            Good Luck, Corn-testants!{" "}
            <strong>
              {prizesRemaining} prize{prizesRemaining === 1 ? "" : "s"}
            </strong>{" "}
            remain!
          </p>
        )}
        {devAllowReplay && (
          <p className="dev-mode-banner" role="status">
            Dev mode: unlimited test plays enabled
          </p>
        )}
        {hasPlayed && playerStatus !== "winner_pending" && (
          <p className="played-banner" role="status">
            Thanks for playing!
          </p>
        )}
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
      </header>

      <CornGrid
        kernels={kernels}
        claimedIds={claimedIds}
        disabled={mustCompleteWin || campaign.status !== "active"}
        loadingId={loadingId}
        onKernelClick={handleKernelClick}
      />

      <footer className="play-footer">
        <a href="/rules">Official Rules</a>
        <span aria-hidden>·</span>
        <a href="/privacy">Privacy</a>
      </footer>

      <Modal
        open={modal.type === "lose"}
        title="You Corn't win em all, but thanks for playing!"
        onClose={() => setModal({ type: "none" })}
      >
        <p>That kernel wasn&apos;t a winner. Thanks for playing Azzip!</p>
        <button type="button" className="btn-primary" onClick={() => setModal({ type: "none" })}>
          OK
        </button>
      </Modal>

      <Modal
        open={modal.type === "message"}
        title={modal.type === "message" ? modal.title : ""}
        onClose={() => setModal({ type: "none" })}
      >
        {modal.type === "message" && (
          <>
            <p>{modal.body}</p>
            <button type="button" className="btn-primary" onClick={() => setModal({ type: "none" })}>
              OK
            </button>
          </>
        )}
      </Modal>

      <Modal open={modal.type === "win"} title="You won!">
        {modal.type === "win" && (
          <WinForm
            claimId={modal.claimId}
            prizeLabel={modal.prizeLabel}
            turnstileSiteKey={turnstileSiteKey}
            onSuccess={(msg) => {
              setPlayerStatus("winner_claimed");
              setModal({ type: "message", title: "Prize claimed!", body: msg });
            }}
            onError={(msg) => setError(msg)}
          />
        )}
      </Modal>
    </div>
  );
}
