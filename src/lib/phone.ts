import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, "US");
  if (!parsed?.isValid()) return null;
  return parsed.format("E.164");
}
