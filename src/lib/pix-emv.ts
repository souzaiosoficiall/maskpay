/**
 * Minimal BR Code / PIX EMV parser (copia-e-cola and QR payload).
 * Spec: EMV QRCPS-MPM + BCB PIX.
 */

export interface ParsedPixQr {
  raw: string;
  amount: number | null;
  merchantName: string | null;
  merchantCity: string | null;
  pixKey: string | null;
  txid: string | null;
  description: string | null;
}

function readTlv(payload: string): Array<{ id: string; value: string }> {
  const out: Array<{ id: string; value: string }> = [];
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len) || i + 4 + len > payload.length) break;
    const value = payload.slice(i + 4, i + 4 + len);
    out.push({ id, value });
    i += 4 + len;
  }
  return out;
}

function findTag(tags: Array<{ id: string; value: string }>, id: string): string | null {
  return tags.find((t) => t.id === id)?.value ?? null;
}

/**
 * Parse a PIX copia-e-cola / EMV string.
 */
export function parsePixEmv(input: string): ParsedPixQr {
  const raw = (input || "").trim().replace(/\s+/g, "");
  if (!raw || raw.length < 20) {
    throw new Error("QR Code PIX inválido.");
  }

  // Must look like EMV (starts with 0002)
  if (!raw.startsWith("0002")) {
    throw new Error("Formato de QR Code não reconhecido. Use um PIX válido.");
  }

  const tags = readTlv(raw);
  const amountStr = findTag(tags, "54");
  const merchantName = findTag(tags, "59");
  const merchantCity = findTag(tags, "60");

  let pixKey: string | null = null;
  let description: string | null = null;
  let txid: string | null = null;

  // Merchant Account Information (26..51) — PIX GUI + key
  for (const t of tags) {
    if (t.id >= "26" && t.id <= "51") {
      const sub = readTlv(t.value);
      const gui = findTag(sub, "00")?.toLowerCase() || "";
      if (gui.includes("br.gov.bcb.pix") || gui.includes("pix")) {
        pixKey = findTag(sub, "01") || pixKey;
        description = findTag(sub, "02") || description;
      }
    }
  }

  // Additional Data Field Template (62) — txid
  const additional = findTag(tags, "62");
  if (additional) {
    const sub = readTlv(additional);
    txid = findTag(sub, "05") || txid;
  }

  let amount: number | null = null;
  if (amountStr) {
    const n = Number(amountStr.replace(",", "."));
    if (!Number.isNaN(n) && n >= 0) amount = Math.round(n * 100) / 100;
  }

  return {
    raw,
    amount,
    merchantName: merchantName ? merchantName.trim() : null,
    merchantCity: merchantCity ? merchantCity.trim() : null,
    pixKey,
    txid,
    description,
  };
}

/** Guess PIX key type for cash-out APIs. */
export function guessPixKeyType(key: string): string {
  const k = key.trim();
  if (/^\d{11}$/.test(k) || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(k)) return "cpf";
  if (/^\d{14}$/.test(k) || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(k)) return "cnpj";
  if (k.includes("@")) return "email";
  if (/^\+?\d{10,15}$/.test(k.replace(/\s/g, ""))) return "phone";
  return "random";
}
