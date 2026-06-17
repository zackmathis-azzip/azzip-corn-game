"use client";

import { useCallback, useEffect, useState } from "react";

type CampaignData = {
  campaign: {
    id: string;
    name: string;
    status: string;
    starts_at: string;
    ends_at: string;
    seed: number;
  } | null;
  prizes: Array<{
    label: string;
    quantity_total: number;
    quantity_remaining: number;
  }>;
  claims: Array<Record<string, unknown>>;
  stats: { completedWinners: number; kernels: Array<{ status: string; count: number }> } | null;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [data, setData] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/campaign");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    if (res.ok) {
      setAuthed(true);
      setData(await res.json());
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    await load();
  }

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthed(false);
    setData(null);
  }

  async function runAction(path: string, body?: object) {
    setLoading(true);
    try {
      await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function voidClaim(claimId: string) {
    await runAction("/api/admin/claims", { claimId, void: true });
  }

  if (!authed) {
    return (
      <div className="admin-shell">
        <h1>Admin Login</h1>
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

  const campaign = data?.campaign;

  return (
    <div className="admin-shell">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Corn Game Admin</h1>
        <button type="button" className="btn-secondary" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <div className="admin-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={loading}
          onClick={() => runAction("/api/admin/seed", { force: true })}
        >
          Seed / Shuffle Campaign
        </button>
        {campaign && (
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={loading}
              onClick={() =>
                runAction("/api/admin/kill-switch", {
                  paused: campaign.status === "active",
                })
              }
            >
              {campaign.status === "active" ? "Pause (Kill Switch)" : "Resume"}
            </button>
            <a
              className="btn-secondary"
              href={`/api/admin/export?campaignId=${campaign.id}`}
              download
            >
              Export Winners CSV
            </a>
          </>
        )}
      </div>

      {!campaign ? (
        <p>No active campaign. Click &quot;Seed / Shuffle Campaign&quot; to start.</p>
      ) : (
        <>
          <div className="admin-card">
            <h2>{campaign.name}</h2>
            <p>Status: <strong>{campaign.status}</strong></p>
            <p>Seed: {campaign.seed}</p>
            <p>
              {new Date(campaign.starts_at).toLocaleString()} —{" "}
              {new Date(campaign.ends_at).toLocaleString()}
            </p>
            <p>Completed winners: {data?.stats?.completedWinners ?? 0}</p>
          </div>

          <div className="admin-card">
            <h3>Prize inventory</h3>
            <ul>
              {data?.prizes.map((p) => (
                <li key={p.label}>
                  {p.label}: {p.quantity_remaining} / {p.quantity_total} remaining
                </li>
              ))}
            </ul>
          </div>

          <div className="admin-card">
            <h3>Recent claims</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Outcome</th>
                  <th>Prize</th>
                  <th>Kernel</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data?.claims ?? []).slice(0, 50).map((c) => (
                  <tr key={String(c.id)}>
                    <td>{new Date(String(c.created_at)).toLocaleString()}</td>
                    <td>{String(c.outcome)}</td>
                    <td>{String(c.prize_label ?? "—")}</td>
                    <td>{String(c.kernel_id)}</td>
                    <td>{String(c.status)}</td>
                    <td>
                      {c.outcome === "win" && c.status === "completed" && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => voidClaim(String(c.id))}
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
