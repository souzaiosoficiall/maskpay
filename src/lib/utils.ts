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
  if (user.length <= 4) return email;
  return `${user.substring(0, 5)}${"*".repeat(8)}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return phone;
  const ddd = digits.substring(0, 2);
  const start = digits.substring(2, 3);
  const end = digits.slice(-4);
  return `(${ddd}) ${start}****-${end}`;
}

export function maskDocument(doc: string | null | undefined): string {
  if (!doc) return "";
  const digits = doc.replace(/\D/g, "");
  if (digits.length === 11) {
    // CPF: 123.***.***-90
    return `${digits.substring(0, 3)}.***.***-${digits.slice(-2)}`;
  } else if (digits.length === 14) {
    // CNPJ: 12.***.***/****-90
    return `${digits.substring(0, 2)}.***.***/****-${digits.slice(-2)}`;
  }
  return doc;
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
