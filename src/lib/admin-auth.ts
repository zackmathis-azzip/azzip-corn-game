import { cookies } from "next/headers";
import { createHash, randomUUID } from "crypto";
import { ADMIN_COOKIE } from "./config";

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8,
};

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return password === expected;
}

export function adminAuthCookieValue(): string {
  const secret = process.env.ADMIN_PASSWORD ?? "";
  return createHash("sha256").update(secret + randomUUID()).digest("hex");
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return false;
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(ADMIN_COOKIE)?.value);
}
