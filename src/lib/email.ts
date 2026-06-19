import { Resend } from "resend";
import { FULFILLMENT_EMAIL, RESEND_FROM_DEFAULT } from "./config";
import { formatPhoneForDisplay } from "./phone";

/** Resend rejects unverified senders — production was set to noreply@azzippizza.com by mistake. */
export function resolveResendFrom(raw = process.env.RESEND_FROM): string {
  const configured = raw?.trim() || RESEND_FROM_DEFAULT;
  if (/noreply@azzippizza\.com/i.test(configured)) {
    return configured.replace(/noreply@azzippizza\.com/gi, "noreply@azzippizza.me");
  }
  return configured;
}

export function normalizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function formatPromotionEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Indiana/Indianapolis",
  });
}

function buildWinnerEmailContent(params: {
  prizeLabel: string;
  phoneE164: string;
  promotionEndsAt: string;
}): { subject: string; text: string; html: string } {
  const phoneDisplay = formatPhoneForDisplay(params.phoneE164);
  const endDate = formatPromotionEndDate(params.promotionEndsAt);
  const subject = `You won from Azzip Pizza — ${params.prizeLabel}`;

  const text = `Thanks for playing the Azzip Corn Kernel Game!

Your prize: ${params.prizeLabel}

What happens next:
- Your prize will be delivered to your Creator Rewards wallet.
- Delivery is expected by the end of the promotion (${endDate}).
- If you do not already have a Creator Rewards account, one may be created for the phone number on file.

Phone number on your claim: ${phoneDisplay}

Questions? Reply to this email and our team will help.

— Azzip Pizza`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; color: #1a1208; line-height: 1.5;">
  <p>Thanks for playing the <strong>Azzip Corn Kernel Game</strong>!</p>
  <p><strong>Your prize:</strong> ${params.prizeLabel}</p>
  <h3 style="margin-bottom: 0.5rem;">What happens next</h3>
  <ul>
    <li>Your prize will be delivered to your <strong>Creator Rewards wallet</strong>.</li>
    <li>Delivery is expected by the end of the promotion (<strong>${endDate}</strong>).</li>
    <li>If you do not already have a Creator Rewards account, one may be created for the phone number on file.</li>
  </ul>
  <p><strong>Phone number on your claim:</strong> ${phoneDisplay}</p>
  <p>Questions? Reply to this email and our team will help.</p>
  <p>— Azzip Pizza</p>
</body>
</html>`;

  return { subject, text, html };
}

export async function sendWinnerConfirmationEmail(params: {
  toEmail: string;
  phoneE164: string;
  prizeLabel: string;
  promotionEndsAt: string;
}): Promise<{ sent: boolean; method: "resend" | "console" }> {
  const apiKey = process.env.RESEND_API_KEY;
  const replyTo = process.env.RESEND_REPLY_TO ?? FULFILLMENT_EMAIL;
  const { subject, text, html } = buildWinnerEmailContent(params);

  if (apiKey) {
    const resend = new Resend(apiKey);
    const from = resolveResendFrom();
    await resend.emails.send({
      from,
      to: params.toEmail,
      cc: [FULFILLMENT_EMAIL],
      replyTo,
      subject,
      text,
      html,
    });
    return { sent: true, method: "resend" };
  }

  console.log("[winner-confirmation]", {
    to: params.toEmail,
    cc: FULFILLMENT_EMAIL,
    replyTo,
    prize: params.prizeLabel,
    phone: params.phoneE164,
    subject,
    text,
  });
  return { sent: false, method: "console" };
}
