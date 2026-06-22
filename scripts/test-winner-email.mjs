import { readFileSync } from "fs";
import { Resend } from "resend";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

const apiKey = process.env.RESEND_API_KEY;
let from = process.env.RESEND_FROM?.trim() || "Azzip Corn Game <noreply@azzippizza.me>";
if (/noreply@azzippizza\.com/i.test(from)) {
  from = from.replace(/noreply@azzippizza\.com/gi, "noreply@azzippizza.me");
}
const replyTo = process.env.RESEND_REPLY_TO ?? process.env.FULFILLMENT_EMAIL ?? "zack.mathis@azzippizza.com";
const cc = process.env.FULFILLMENT_EMAIL ?? "zack.mathis@azzippizza.com";
const to = process.argv[2] ?? "zack.mathis@azzippizza.com";

const prizeLabel = "Free Love It Elote (test)";
const phoneDisplay = "(317) 555-0199";
const endDate = new Date("2026-06-30T23:59:59.000Z").toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Indiana/Indianapolis",
});
const subject = `You won from Azzip Pizza — ${prizeLabel}`;

// Mirrors src/lib/email.ts buildWinnerEmailContent (current production copy)
const text = `This email got lost in the corn maze, but it's finally made it to your inbox! Thanks again for playing, and keep an eye out for your prize!

Your prize: ${prizeLabel}

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
  <p>This email got lost in the corn maze, but it's finally made it to your inbox! Thanks again for playing, and keep an eye out for your prize!</p>
  <p><strong>Your prize:</strong> ${prizeLabel}</p>
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

if (!apiKey) {
  console.error("FAIL: RESEND_API_KEY missing in .env.local");
  process.exit(1);
}

console.log("From:", from);
console.log("To:", to);
console.log("CC:", cc);
console.log("Reply-To:", replyTo);
console.log("Subject:", subject);

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({
  from,
  to,
  cc: [cc],
  replyTo,
  subject,
  text,
  html,
});

if (error) {
  console.error("FAIL:", JSON.stringify(error, null, 2));
  process.exit(1);
}

console.log("OK: email accepted by Resend, id:", data?.id);
