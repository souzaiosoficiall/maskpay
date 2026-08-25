import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const user = parts[0] ?? "";
  const domain = parts[1] ?? "";
  const visible = Math.min(3, Math.max(1, user.length));
  const stars = Math.max(4, user.length - visible);
  return `${user.substring(0, visible)}${"*".repeat(stars)}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "*".repeat(Math.max(digits.length, 4));
  const ddd = digits.substring(0, 2);
  const end = digits.slice(-2);
  return `(${ddd}) *****-**${end}`;
}

export function maskDocument(doc: string | null | undefined): string {
  if (!doc) return "";
  const digits = doc.replace(/\D/g, "");
  if (digits.length === 11) {
    // CPF: 182.***.***-**
    return `${digits.substring(0, 3)}.***.***-**`;
  } else if (digits.length === 14) {
    // CNPJ: 12.***.***/****-**
    return `${digits.substring(0, 2)}.***.***/****-**`;
  }
  if (digits.length > 4) {
    return `${digits.substring(0, 2)}${"*".repeat(digits.length - 2)}`;
  }
  return "*".repeat(digits.length || 4);
}

/** SHA-256 hex digest (Node / Edge). Used for PIN and API secrets. */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Compare transaction PIN supporting legacy plaintext and hashed values. */
export async function verifyTransactionPin(
  stored: string | null | undefined,
  input: string,
): Promise<boolean> {
  if (!stored || !input) return false;
  if (stored === input) return true; // legacy plaintext
  const hashed = await sha256Hex(input);
  return stored === hashed;
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  const firstPart = parts[0];
  if (!firstPart) return "??";
  if (parts.length === 1) return firstPart.substring(0, 2).toUpperCase();
  const lastPart = parts[parts.length - 1];
  if (!lastPart) return firstPart.substring(0, 2).toUpperCase();
  const firstChar = firstPart[0] || "";
  const lastChar = lastPart[0] || "";
  return (firstChar + lastChar).toUpperCase();
}
