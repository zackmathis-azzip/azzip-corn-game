"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  claimId: string;
  prizeLabel: string;
  turnstileSiteKey: string | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void }
      ) => string;
      reset: (id: string) => void;
    };
  }
}

export function WinForm({ claimId, prizeLabel, turnstileSiteKey, onSuccess, onError }: Props) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileRef.current) return;

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      if (window.turnstile && turnstileRef.current && !widgetId.current) {
        widgetId.current = window.turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token: string) => setTurnstileToken(token),
        });
      }
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [turnstileSiteKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/claims/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId,
          email,
          phone,
          consent,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        onError(data.message ?? "Could not complete claim.");
        if (widgetId.current && window.turnstile) {
          window.turnstile.reset(widgetId.current);
          setTurnstileToken("");
        }
        return;
      }

      onSuccess("Prize claimed! We'll be in touch soon.");
    } catch {
      onError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="win-form">
      <p className="win-prize">You won: <strong>{prizeLabel}</strong></p>
      <p className="win-copy">Enter your contact info to claim your prize. One play per person.</p>

      <label className="form-label">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </label>

      <label className="form-label">
        Phone
        <input
          type="tel"
          required
          autoComplete="tel"
          placeholder="(317) 555-1234"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
        />
      </label>

      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={loading}
          required
        />
        <span>
          I agree to the{" "}
          <a href="/rules" target="_blank" rel="noopener noreferrer">
            Official Rules
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          . I am 18 or older.
        </span>
      </label>

      {turnstileSiteKey && <div ref={turnstileRef} className="turnstile-wrap" />}

      <button type="submit" className="btn-primary" disabled={loading || !consent}>
        {loading ? "Submitting…" : "Claim Prize"}
      </button>
    </form>
  );
}
