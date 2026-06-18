import { NextRequest, NextResponse } from "next/server";
import { claimKernel } from "@/lib/game";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createSessionToken,
  getSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/session";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: kernelId } = await params;
  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  let sessionToken = await getSessionToken();
  const isNewSession = !sessionToken;
  if (!sessionToken) {
    sessionToken = createSessionToken();
  }

  const rateKey = `${ip}:${sessionToken}`;
  const rate = checkRateLimit(rateKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Please wait." },
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
    { status: result.ok ? 200 : result.error === "already_played" || result.error === "kernel_taken" ? 409 : 400 }
  );

  if (isNewSession) {
    response.cookies.set(SESSION_COOKIE, sessionToken, SESSION_COOKIE_OPTIONS);
  }

  return response;
}
