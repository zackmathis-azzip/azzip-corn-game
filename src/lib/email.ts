import { Resend } from "resend";
import { FULFILLMENT_EMAIL } from "./config";

export function normalizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function notifyWinner(params: {
  prizeLabel: string;
  kernelId: string;
  claimId: string;
}): Promise<{ sent: boolean; method: "resend" | "console" }> {
  const apiKey = process.env.RESEND_API_KEY;
  const subject = `Azzip Corn Game Winner — ${params.prizeLabel}`;
  const body = `New winner!\n\nPrize: ${params.prizeLabel}\nKernel: ${params.kernelId}\nClaim ID: ${params.claimId}\n\nFulfill via admin CSV export.`;

  if (apiKey) {
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM ?? "Azzip Corn Game <onboarding@resend.dev>";
    await resend.emails.send({
      from,
      to: FULFILLMENT_EMAIL,
      subject,
      text: body,
    });
    return { sent: true, method: "resend" };
  }

  console.log("[winner-notification]", {
    prize: params.prizeLabel,
    kernelId: params.kernelId,
    claimId: params.claimId,
    to: FULFILLMENT_EMAIL,
  });
  return { sent: false, method: "console" };
}
