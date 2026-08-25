/**
 * BR Code / PIX EMV parser (copia-e-cola and QR payload).
 * Spec: EMV QRCPS-MPM + BCB PIX (static + dynamic).
 */

export interface ParsedPixQr {
  raw: string;
  amount: number | null;
  merchantName: string | null;
  merchantCity: string | null;
  /** PIX key when present (static QR). */
  pixKey: string | null;
  /** Location URL for dynamic PIX (tag 25). */
  pixUrl: string | null;
  txid: string | null;
  description: string | null;
  /** True when payload looks like valid PIX EMV. */
  isPix: boolean;
}

function readTlv(payload: string): Array<{ id: string; value: string }> {
  const out: Array<{ id: string; value: string }> = [];
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const lenStr = payload.slice(i + 2, i + 4);
    const len = parseInt(lenStr, 10);
    if (Number.isNaN(len) || len < 0 || i + 4 + len > payload.length) break;
    const value = payload.slice(i + 4, i + 4 + len);
    out.push({ id, value });
    i += 4 + len;
  }
  return out;
}

function findTag(tags: Array<{ id: string; value: string }>, id: string): string | null {
  return tags.find((t) => t.id === id)?.value ?? null;
}

function looksLikePixKey(value: string): boolean {
  const v = value.trim();
  if (!v || v.length < 5) return false;
  // email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return true;
  // CPF 11 digits
  if (/^\d{11}$/.test(v)) return true;
  // CNPJ 14 digits
  if (/^\d{14}$/.test(v)) return true;
  // phone +55...
  if (/^\+?55\d{10,11}$/.test(v.replace(/\s/g, ""))) return true;
  if (/^\d{10,11}$/.test(v)) return true;
  // EVP / random key UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return true;
  // some keys without dashes (32 hex)
  if (/^[0-9a-f]{32}$/i.test(v)) return true;
  return false;
}

function isPixGui(gui: string): boolean {
  const g = gui.toLowerCase();
  return (
    g.includes("br.gov.bcb.pix") ||
    g.includes("br.gov.bcb") ||
    g === "pix" ||
    g.includes("pix")
  );
}

/**
 * Parse a PIX copia-e-cola / EMV string (or raw QR content).
 */
export function parsePixEmv(input: string): ParsedPixQr {
  let raw = (input || "").trim();
  // Remove invisible chars / newlines often introduced by scanners
  raw = raw.replace(/[\r\n\t\s]/g, "");

  if (!raw || raw.length < 15) {
    throw new Error("QR Code PIX inválido ou vazio.");
  }

  // Some readers return a URL wrapping the EMV — try extract
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    // Dynamic location URL alone
    return {
      raw,
      amount: null,
      merchantName: null,
      merchantCity: null,
      pixKey: null,
      pixUrl: raw,
      txid: null,
      description: null,
      isPix: true,
    };
  }

  if (!raw.startsWith("0002")) {
    // Sometimes payload is base64 — try decode once
    try {
      const decoded = atob(raw);
      if (decoded.startsWith("0002")) {
        return parsePixEmv(decoded);
      }
    } catch {
      // ignore
    }
    throw new Error("Formato de QR Code não reconhecido. Use um PIX válido (EMV).");
  }

  const tags = readTlv(raw);
  if (!tags.length) {
    throw new Error("Não foi possível interpretar o QR Code PIX.");
  }

  const amountStr = findTag(tags, "54");
  const merchantName = findTag(tags, "59");
  const merchantCity = findTag(tags, "60");

  let pixKey: string | null = null;
  let pixUrl: string | null = null;
  let description: string | null = null;
  let txid: string | null = null;
  let isPix = false;

  // Merchant Account Information (26–51)
  for (const t of tags) {
    if (t.id < "26" || t.id > "51") continue;
    const sub = readTlv(t.value);
    if (!sub.length) continue;

    const gui = findTag(sub, "00") || "";
    const guiIsPix = isPixGui(gui);
    if (guiIsPix) isPix = true;

    // Static: key in 01
    const key01 = findTag(sub, "01");
    if (key01 && (guiIsPix || looksLikePixKey(key01))) {
      pixKey = key01;
      isPix = true;
    }

    // Dynamic: location URL in 25
    const url25 = findTag(sub, "25");
    if (url25 && (guiIsPix || url25.startsWith("http"))) {
      pixUrl = url25.startsWith("http") ? url25 : `https://${url25}`;
      isPix = true;
    }

    // Description sometimes in 02
    const desc02 = findTag(sub, "02");
    if (desc02) description = desc02;

    // Fallback: any sub-value that looks like a PIX key
    if (!pixKey) {
      for (const s of sub) {
        if (s.id === "00" || s.id === "25") continue;
        if (looksLikePixKey(s.value)) {
          pixKey = s.value.trim();
          isPix = true;
          break;
        }
      }
    }
  }

  // Additional Data Field (62) — txid / reference
  const additional = findTag(tags, "62");
  if (additional) {
    const sub = readTlv(additional);
    txid = findTag(sub, "05") || findTag(sub, "01") || txid;
  }

  // Last-resort: scan whole payload with regex for UUID/email
  if (!pixKey) {
    const uuid = raw.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    if (uuid) pixKey = uuid[0];
  }
  if (!pixKey) {
    const email = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (email) pixKey = email[0];
  }

  // If GUI was never found but structure is EMV with MAI, still mark as pix attempt
  if (!isPix && tags.some((t) => t.id >= "26" && t.id <= "51")) {
    isPix = true;
  }

  let amount: number | null = null;
  if (amountStr) {
    const n = Number(String(amountStr).replace(",", "."));
    if (!Number.isNaN(n) && n > 0) amount = Math.round(n * 100) / 100;
  }

  // Fallback: scan raw EMV for tag 54 (amount) — handles odd TLV edge cases
  if (amount == null || amount <= 0) {
    const m = raw.match(/54(\d{2})(\d+(?:\.\d{1,2})?)/);
    if (m) {
      const len = parseInt(m[1], 10);
      const val = m[2].slice(0, len);
      const n = Number(val);
      if (Number.isFinite(n) && n > 0) amount = Math.round(n * 100) / 100;
    }
  }

  return {
    raw,
    amount,
    merchantName: merchantName ? merchantName.trim() : null,
    merchantCity: merchantCity ? merchantCity.trim() : null,
    pixKey: pixKey ? pixKey.trim() : null,
    pixUrl,
    txid,
    description,
    isPix,
  };
}

/** Guess PIX key type for cash-out APIs. */
export function guessPixKeyType(key: string): string {
  const k = key.trim();
  if (/^\d{11}$/.test(k) || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(k)) return "cpf";
  if (/^\d{14}$/.test(k) || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(k)) return "cnpj";
  if (k.includes("@")) return "email";
  if (/^\+?\d{10,15}$/.test(k.replace(/\D/g, "")) || /^\+?55\d{10,11}$/.test(k.replace(/\s/g, "")))
    return "phone";
  return "random";
}

/**
 * Extract location URL from a dynamic PIX EMV (tag 25 inside MAI 26–51).
 */
export function extractPixLocationUrl(emv: string): string | null {
  try {
    const parsed = parsePixEmv(emv);
    if (parsed.pixUrl) return parsed.pixUrl;
  } catch {
    // continue with manual scan
  }
  const raw = emv.replace(/\s/g, "");
  // Heuristic: host.../v2/qr/... or /pix/v2/...
  const m = raw.match(
    /((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[a-zA-Z0-9._\-\/]+)?)/i
  );
  if (m) {
    const path = m[1];
    if (path.includes("pix") || path.includes("qr") || path.includes("cob")) {
      return path.startsWith("http") ? path : `https://${path}`;
    }
  }
  return null;
}

/**
 * Try to decode amount from common PIX location JSON / JWT payloads.
 */
export function extractAmountFromPixPayload(body: any): number | null {
  if (!body) return null;

  // Plain JSON shapes used by several PSPs / Open Finance / BACEN
  const candidates = [
    body?.valor?.original,
    body?.valor?.final,
    body?.valor?.modalidadeAlteracao,
    body?.valor,
    body?.value?.original,
    body?.value,
    body?.amount,
    body?.originalAmount,
    body?.calendar?.valor,
    body?.cob?.valor?.original,
    body?.cob?.valor,
    body?.payload?.valor?.original,
    body?.payload?.valor,
    body?.data?.valor?.original,
    body?.data?.valor,
    body?.charge?.amount,
    body?.payment?.amount,
    body?.txid && body?.valor,
  ];

  const tryNum = (v: any): number | null => {
    if (v == null) return null;
    if (typeof v === "object") {
      return (
        tryNum((v as any).original) ??
        tryNum((v as any).final) ??
        tryNum((v as any).amount) ??
        tryNum((v as any).value)
      );
    }
    const cleaned = String(v).replace(",", ".").replace(/[^0-9.]/g, "");
    const num = Number(cleaned);
    if (Number.isFinite(num) && num > 0 && num < 1e9) return Math.round(num * 100) / 100;
    return null;
  };

  for (const c of candidates) {
    const n = tryNum(c);
    if (n) return n;
  }

  // Deep walk for keys valor/amount/original
  const walk = (obj: any, depth = 0): number | null => {
    if (!obj || depth > 6) return null;
    if (typeof obj !== "object") return tryNum(obj);
    for (const [k, v] of Object.entries(obj)) {
      const key = k.toLowerCase();
      if (["valor", "amount", "original", "value", "final"].includes(key)) {
        const n = tryNum(v);
        if (n) return n;
      }
      if (v && typeof v === "object") {
        const n = walk(v, depth + 1);
        if (n) return n;
      }
    }
    return null;
  };
  const deep = walk(body);
  if (deep) return deep;

  // JWT / JWS compact: header.payload.sig — decode middle part
  if (typeof body === "string" && body.split(".").length >= 2) {
    try {
      const mid = body.split(".")[1];
      const b64 = mid.replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      let jsonStr = "";
      if (typeof atob !== "undefined") {
        jsonStr = decodeURIComponent(
          Array.prototype.map
            .call(atob(pad), (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
      } else {
        // Node
        jsonStr = (globalThis as any).Buffer.from(pad, "base64").toString("utf8");
      }
      const json = JSON.parse(jsonStr);
      return extractAmountFromPixPayload(json);
    } catch {
      return null;
    }
  }

  return null;
}

export function extractMerchantFromPixPayload(body: any): string | null {
  if (!body || typeof body !== "object") return null;
  return (
    body?.recebedor?.nome ||
    body?.merchantName ||
    body?.nome ||
    body?.cob?.recebedor?.nome ||
    null
  );
}

export function extractKeyFromPixPayload(body: any): string | null {
  if (!body || typeof body !== "object") return null;
  const k =
    body?.chave ||
    body?.pixKey ||
    body?.key ||
    body?.cob?.chave ||
    body?.recebedor?.chave ||
    null;
  return k ? String(k) : null;
}
