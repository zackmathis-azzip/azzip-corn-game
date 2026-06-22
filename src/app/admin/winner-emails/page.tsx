"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type WinnerRow = {
  claimId: string;
  email: string;
  phoneE164: string;
  prizeLabel: string;
  kernelId: string;
  completedAt: string;
  notifiedAt: string | null;
  voided: boolean;
};

type Preview = {
  subject: string;
  text: string;
  html: string;
};

type QueueData = {
  campaign: { id: string; name: string } | null;
  winners: WinnerRow[];
  summary: { total: number; pending: number; sent: number; voided: number };
};

export default function WinnerEmailsAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    email: string | null;
    notifiedAt: string | null;
    voided: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "sent">("pending");

  const loadQueue = useCallback(async () => {
    const res = await fetch("/api/admin/winner-emails");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    if (res.ok) {
      setAuthed(true);
      setQueue(await res.json());
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setLoginError("Invalid password");
      return;
    }
    setAuthed(true);
    await loadQueue();
  }

  async function loadPreview(claimId: string) {
    setSelectedId(claimId);
    setSendError(null);
    setSendSuccess(null);
    const res = await fetch(`/api/admin/winner-emails/${claimId}/preview`);
    if (!res.ok) {
      setPreview(null);
      setSendError("Could not load preview");
      return;
    }
    const data = await res.json();
    setPreview(data.preview);
    setPreviewMeta({
      email: data.email,
      notifiedAt: data.notifiedAt,
      voided: data.voided,
    });
  }

  async function sendEmail(allowResend: boolean) {
    if (!selectedId) return;
    setLoading(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const res = await fetch("/api/admin/winner-emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: selectedId, allowResend }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Send failed");
        return;
      }
      setSendSuccess(
        data.resent
          ? `Resent to ${data.toEmail}`
          : `Sent to ${data.toEmail}`
      );
      await loadQueue();
      await loadPreview(selectedId);
    } finally {
      setLoading(false);
    }
  }

  if (!authed) {
    return (
      <div className="admin-shell">
        <h1>Winner Emails</h1>
        <form className="admin-login" onSubmit={handleLogin}>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {loginError && <p className="error-banner">{loginError}</p>}
          <button type="submit" className="btn-primary">
            Sign in
          </button>
        </form>
      </div>
    );
  }

  const winners = (queue?.winners ?? []).filter((w) => {
    if (filter === "pending") return !w.voided && !w.notifiedAt;
    if (filter === "sent") return !w.voided && Boolean(w.notifiedAt);
    return true;
  });

  const selected = queue?.winners.find((w) => w.claimId === selectedId);

  return (
    <div className="admin-shell winner-emails-shell">
      <header className="winner-emails-header">
        <div>
          <h1>Winner confirmation emails</h1>
          <p className="winner-emails-subtitle">
            Preview each email, then approve send one at a time. Data comes from the live
            database (same export as your CSV).
          </p>
        </div>
        <div className="winner-emails-header-actions">
          <Link href="/admin" className="btn-secondary">
            ← Admin
          </Link>
        </div>
      </header>

      {queue?.summary && (
        <div className="admin-card winner-emails-summary">
          <strong>{queue.campaign?.name}</strong>
          <span>
            {queue.summary.total} winners · {queue.summary.pending} not notified ·{" "}
            {queue.summary.sent} notified
            {queue.summary.voided > 0 ? ` · ${queue.summary.voided} voided` : ""}
          </span>
        </div>
      )}

      <div className="winner-emails-filters">
        <button
          type="button"
          className={`timeline-pill${filter === "pending" ? " timeline-pill--active" : ""}`}
          onClick={() => setFilter("pending")}
        >
          Not sent ({queue?.summary.pending ?? 0})
        </button>
        <button
          type="button"
          className={`timeline-pill${filter === "sent" ? " timeline-pill--active" : ""}`}
          onClick={() => setFilter("sent")}
        >
          Sent ({queue?.summary.sent ?? 0})
        </button>
        <button
          type="button"
          className={`timeline-pill${filter === "all" ? " timeline-pill--active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
      </div>

      <div className="winner-emails-layout">
        <div className="admin-card winner-emails-list">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Prize</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {winners.map((w) => (
                <tr
                  key={w.claimId}
                  className={w.claimId === selectedId ? "winner-emails-row--selected" : ""}
                >
                  <td>
                    <button
                      type="button"
                      className="winner-emails-select"
                      onClick={() => loadPreview(w.claimId)}
                    >
                      {w.email}
                    </button>
                  </td>
                  <td>{w.prizeLabel}</td>
                  <td>
                    {w.voided ? (
                      <span className="winner-emails-badge winner-emails-badge--void">Void</span>
                    ) : w.notifiedAt ? (
                      <span className="winner-emails-badge winner-emails-badge--sent">Sent</span>
                    ) : (
                      <span className="winner-emails-badge winner-emails-badge--pending">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-card winner-emails-preview">
          {!selected || !preview ? (
            <p>Select a winner to preview their confirmation email.</p>
          ) : (
            <>
              <h2>{preview.subject}</h2>
              <p>
                <strong>To:</strong> {previewMeta?.email ?? selected.email}
              </p>
              <p>
                <strong>Prize:</strong> {selected.prizeLabel} · <strong>Phone:</strong>{" "}
                {selected.phoneE164}
              </p>
              {previewMeta?.notifiedAt && (
                <p className="winner-emails-notified">
                  Previously sent {new Date(previewMeta.notifiedAt).toLocaleString()}
                </p>
              )}

              <div className="winner-emails-preview-frame-wrap">
                <iframe
                  title="Email preview"
                  className="winner-emails-preview-frame"
                  sandbox=""
                  srcDoc={preview.html}
                />
              </div>

              <details className="winner-emails-plaintext">
                <summary>Plain-text version</summary>
                <pre>{preview.text}</pre>
              </details>

              {sendError && <p className="error-banner">{sendError}</p>}
              {sendSuccess && <p className="played-banner">{sendSuccess}</p>}

              <div className="winner-emails-send-actions">
                {!previewMeta?.voided && !previewMeta?.notifiedAt && (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={loading}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Send winner email to ${previewMeta?.email ?? selected.email}?`
                        )
                      ) {
                        void sendEmail(false);
                      }
                    }}
                  >
                    {loading ? "Sending…" : "Send email"}
                  </button>
                )}
                {!previewMeta?.voided && previewMeta?.notifiedAt && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={loading}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Resend winner email to ${previewMeta?.email ?? selected.email}? They were already notified.`
                        )
                      ) {
                        void sendEmail(true);
                      }
                    }}
                  >
                    {loading ? "Sending…" : "Resend email"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
