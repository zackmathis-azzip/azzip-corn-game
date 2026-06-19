import { readFileSync } from "fs";
import { Resend } from "resend";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  process.env[key] = value;
}

const apiKey = process.env.RESEND_API_KEY;
let from = process.env.RESEND_FROM;
if (from?.includes("noreply@azzippizza.com")) {
  from = from.replace(/noreply@azzippizza\.com/gi, "noreply@azzippizza.me");
}
if (!from) from = "Azzip Corn Game <noreply@azzippizza.me>";
const replyTo = process.env.RESEND_REPLY_TO ?? process.env.FULFILLMENT_EMAIL;
const to = process.env.FULFILLMENT_EMAIL ?? "zack.mathis@azzippizza.com";

if (!apiKey) {
  console.error("FAIL: RESEND_API_KEY missing");
  process.exit(1);
}
if (!from) {
  console.error("FAIL: RESEND_FROM missing");
  process.exit(1);
}

console.log("From:", from);
console.log("Reply-To:", replyTo);
console.log("To:", to);

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({
  from,
  to,
  replyTo,
  subject: "Azzip Corn Game — Resend verification test",
  text: "If you received this, Option A (noreply@azzippizza.me) is working.",
});

if (error) {
  console.error("FAIL:", JSON.stringify(error, null, 2));
  process.exit(1);
}

console.log("OK: email accepted by Resend, id:", data?.id);
