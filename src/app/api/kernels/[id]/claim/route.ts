import { NextRequest, NextResponse } from "next/server";
import { claimKernel } from "@/lib/game";
import { clientIp } from "@/lib/client-ip";
import { devAllowReplay } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createSessionToken,
  getSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/session";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id: kernelId } = await params;
  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  let body: { turnstileToken?: string } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as { turnstileToken?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!devAllowReplay()) {
    const turnstileOk = await verifyTurnstile(body.turnstileToken ?? "", ip);
    if (!turnstileOk) {
      return NextResponse.json(
        { ok: false, error: "captcha_failed", message: "Please complete verification before playing." },
        { status: 400 }
      );
    }
  }

  let sessionToken = await getSessionToken();
  const isNewSession = !sessionToken;
  if (!sessionToken) {
    sessionToken = createSessionToken();
  }

  const rateKey = `${ip}:${sessionToken}`;
  const rate = checkRateLimit(rateKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Please wait." },
      { status: 429 }
    );
  }

  const result = await claimKernel({ kernelId, sessionToken, ip, userAgent });

  const response = NextResponse.json(
    result.ok
      ? {
          ok: true,
          outcome: result.outcome,
          claimId: result.claimId,
          prizeLabel: result.prizeLabel,
        }
      : {
          ok: false,
          error: result.error,
          message: result.message,
        },
    {
      status: result.ok
        ? 200
        : result.error === "already_played" || result.error === "kernel_taken"
          ? 409
          : result.error === "ip_limit_exceeded"
            ? 429
            : 400,
    }
  );

  if (isNewSession) {
    response.cookies.set(SESSION_COOKIE, sessionToken, SESSION_COOKIE_OPTIONS);
  }

  return response;
}
