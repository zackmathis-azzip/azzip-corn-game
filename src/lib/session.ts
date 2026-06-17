import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { SESSION_COOKIE } from "./config";

export { SESSION_COOKIE };

export async function getSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

export function createSessionToken(): string {
  return randomUUID();
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
