"use client";

import { useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "./TurnstileWidget";

type Props = {
  claimId: string;
  prizeLabel: string;
  turnstileSiteKey: string | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function WinForm({ claimId, prizeLabel, turnstileSiteKey, onSuccess, onError }: Props) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const needsTurnstile = Boolean(turnstileSiteKey);
  const canSubmit = consent && (!needsTurnstile || Boolean(turnstileToken));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!canSubmit) {
      setFormError(
        needsTurnstile && !turnstileToken
          ? "Please complete verification below before claiming."
          : "Please agree to the terms to continue."
      );
      return;
    }

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
        const message = data.message ?? "Could not complete claim.";
        setFormError(message);
        onError(message);
        turnstileRef.current?.reset();
        setTurnstileToken("");
        return;
      }

      onSuccess("Prize claimed! We'll be in touch soon.");
    } catch {
      const message = "Network error. Please try again.";
      setFormError(message);
      onError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="win-form">
      <p className="win-prize">
        You won: <strong>{prizeLabel}</strong>
      </p>
      <p className="win-copy">
        Enter your contact info to claim your prize. One play per person. Prize will be delivered by the
        end of the promotion to your Creator Rewards wallet. If you don&apos;t have a Creator Rewards
        account, it may be created on your behalf.
      </p>

      {formError && (
        <p className="win-form-error" role="alert">
          {formError}
        </p>
      )}

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

      {turnstileSiteKey && (
        <>
          <TurnstileWidget
            ref={turnstileRef}
            siteKey={turnstileSiteKey}
            onToken={(token) => {
              setTurnstileToken(token);
              setFormError(null);
            }}
            onExpire={() => setTurnstileToken("")}
            className="turnstile-wrap"
          />
          {!turnstileToken && (
            <p className="turnstile-hint">Complete verification to enable Claim Prize.</p>
          )}
        </>
      )}

      <button type="submit" className="btn-primary" disabled={loading || !canSubmit}>
        {loading ? "Submitting…" : "Claim Prize"}
      </button>
    </form>
  );
}
