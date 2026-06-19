"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CornGrid, type KernelCell } from "./CornGrid";
import { Modal } from "./Modal";
import { WinForm } from "./WinForm";
import { TurnstileWidget, type TurnstileWidgetHandle } from "./TurnstileWidget";
import { POLL_INTERVAL_MS } from "@/lib/config";
import { randomHuskMessage } from "@/lib/husk-messages";

type CampaignInfo = {
  id: string;
  name: string;
  status: string;
  seed?: number;
};

type ModalState =
  | { type: "none" }
  | { type: "win"; claimId: string; prizeLabel: string }
  | { type: "lose" }
  | { type: "message"; title: string; body: string }
  | { type: "husk"; body: string };

/** Turn bare azzippizza.com URLs in husk messages into clickable links. */
function renderWithLinks(text: string): React.ReactNode {
  const parts = text.split(/(\b(?:order|rewards)\.azzippizza\.com\b)/g);
  return parts.map((part, i) =>
    /^(?:order|rewards)\.azzippizza\.com$/.test(part) ? (
      <a key={i} href={`https://${part}`} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

type Props = {
  turnstileSiteKey: string | null;
  devReplayEnabled?: boolean;
};

export function CornGame({ turnstileSiteKey, devReplayEnabled = false }: Props) {
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [kernels, setKernels] = useState<KernelCell[]>([]);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [playerStatus, setPlayerStatus] = useState<string | null>(null);
  const [prizesRemaining, setPrizesRemaining] = useState<number | null>(null);
  const [devAllowReplay, setDevAllowReplay] = useState(devReplayEnabled);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [devPreviewCompletedBoard, setDevPreviewCompletedBoard] = useState(false);
  const playTurnstileRef = useRef<TurnstileWidgetHandle>(null);

  const mustCompleteWin = playerStatus === "winner_pending";
  const hasPlayed =
    !devAllowReplay &&
    (playerStatus === "finished" ||
      playerStatus === "winner_pending" ||
      playerStatus === "winner_claimed");
  const playBlocked = mustCompleteWin || hasPlayed;
  const needsTurnstile =
    Boolean(turnstileSiteKey) &&
    campaign?.status === "active" &&
    !playBlocked &&
    !devAllowReplay;
  const turnstileReady = !needsTurnstile || Boolean(turnstileToken);

  const resetPlayTurnstile = useCallback(() => {
    playTurnstileRef.current?.reset();
    setTurnstileToken("");
  }, []);

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
    } else if (devReplayEnabled) {
      setDevAllowReplay(true);
    }

    if (full && data.kernels) {
      setKernels(data.kernels);
    }

    if (data.playerStatus === "winner_pending" && data.pendingClaimId && !data.devAllowReplay) {
      setModal((m) =>
        m.type === "win"
          ? m
          : { type: "win", claimId: data.pendingClaimId, prizeLabel: "Your prize" }
      );
    } else if (data.playerStatus !== "winner_pending" && !data.devAllowReplay) {
      setModal((m) => {
        if (m.type !== "win") return m;
        return {
          type: "message",
          title: "Claim window ended",
          body: "Your prize claim time expired and the kernel returned to the pool. Thanks for playing!",
        };
      });
    }
  }, [devReplayEnabled]);

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

  function handleHuskClick() {
    const canStillPickKernel =
      !playBlocked && campaign?.status === "active" && !devPreviewCompletedBoard;
    setModal({ type: "husk", body: randomHuskMessage(canStillPickKernel) });
  }

  async function handleKernelClick(kernelId: string) {
    if (playBlocked || loadingId || !turnstileReady) return;

    setLoadingId(kernelId);
    setError(null);

    try {
      const res = await fetch(`/api/kernels/${encodeURIComponent(kernelId)}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnstileToken: turnstileToken || undefined,
        }),
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
        } else if (data.error === "captcha_failed") {
          setError(data.message ?? "Please complete verification before playing.");
          resetPlayTurnstile();
        } else if (data.error === "ip_limit_exceeded") {
          setModal({
            type: "message",
            title: "Play Limit Reached",
            body: data.message ?? "Too many plays from your network. Please try again later.",
          });
        } else if (data.error === "kernel_taken") {
          setError(data.message ?? "That kernel was just taken.");
          resetPlayTurnstile();
          if (campaign) await refreshState(campaign.id, false);
        } else {
          setError(data.message ?? "Something went wrong.");
          resetPlayTurnstile();
        }
        return;
      }

      setTurnstileToken("");

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
        if (devAllowReplay) resetPlayTurnstile();
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
          <div className="dev-mode-banner" role="status">
            <p>Dev mode: unlimited test plays enabled</p>
            <button
              type="button"
              className="dev-mode-toggle"
              aria-pressed={devPreviewCompletedBoard}
              onClick={() => setDevPreviewCompletedBoard((on) => !on)}
            >
              {devPreviewCompletedBoard ? "Show live board" : "Preview completed board"}
            </button>
          </div>
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
        {needsTurnstile && !turnstileToken && (
          <p className="turnstile-hint" role="status">
            Complete verification below to pick a kernel.
          </p>
        )}
      </header>

      {needsTurnstile && (
        <TurnstileWidget
          ref={playTurnstileRef}
          siteKey={turnstileSiteKey!}
          onToken={setTurnstileToken}
          onExpire={resetPlayTurnstile}
          className="turnstile-wrap play-turnstile"
        />
      )}

      <CornGrid
        kernels={kernels}
        claimedIds={claimedIds}
        disabled={
          devPreviewCompletedBoard ||
          mustCompleteWin ||
          campaign.status !== "active" ||
          playBlocked ||
          !turnstileReady
        }
        loadingId={loadingId}
        previewAllClaimed={devPreviewCompletedBoard}
        campaignSeed={campaign.seed ?? 0}
        onKernelClick={handleKernelClick}
        onHuskClick={handleHuskClick}
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
        <p>Aww, shucks! That kernel wasn&apos;t a winner.</p>
        <br></br>
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

      <Modal
        open={modal.type === "husk"}
        title="A word from the husk 🌽"
        onClose={() => setModal({ type: "none" })}
      >
        {modal.type === "husk" && (
          <>
            <p>{renderWithLinks(modal.body)}</p>
            <br />
            <button
              type="button"
              className="btn-primary"
              onClick={() => setModal({ type: "none" })}
            >
              Back to the corn
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
              setPlayerStatus(devAllowReplay ? "new" : "winner_claimed");
              setModal({ type: "message", title: "Prize claimed!", body: msg });
              if (devAllowReplay) resetPlayTurnstile();
            }}
            onError={(msg) => setError(msg)}
          />
        )}
      </Modal>
    </div>
  );
}
