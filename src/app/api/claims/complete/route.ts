import { NextRequest, NextResponse } from "next/server";
import { completeClaim } from "@/lib/game";
import { clientIp } from "@/lib/client-ip";
import { devAllowReplay } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSessionToken } from "@/lib/session";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    return NextResponse.json(
      { error: "no_session", message: "Session required." },
      { status: 401 }
    );
  }

  const ip = clientIp(request);
  const rate = checkRateLimit(`complete:${ip}:${sessionToken}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests." },
      { status: 429 }
    );
  }

  let body: {
    claimId?: string;
    email?: string;
    phone?: string;
    consent?: boolean;
    turnstileToken?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const turnstileOk =
    devAllowReplay() || (await verifyTurnstile(body.turnstileToken ?? "", ip));
  if (!turnstileOk) {
    return NextResponse.json(
      { error: "captcha_failed", message: "Please complete verification before claiming." },
      { status: 400 }
    );
  }

  const result = await completeClaim({
    claimId: body.claimId ?? "",
    sessionToken,
    email: body.email ?? "",
    phone: body.phone ?? "",
    consent: Boolean(body.consent),
    ip,
    userAgent: request.headers.get("user-agent") ?? "unknown",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, claimId: result.claimId });
}
