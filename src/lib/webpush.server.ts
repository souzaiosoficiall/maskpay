// Server-only Web Push implementation.
//
// Implements RFC 8291 (Message Encryption for Web Push) and RFC 8292
// (VAPID) using only the standard Web Crypto API (`crypto.subtle`), which
// is available in both Node.js and Cloudflare Workers/Nitro edge runtimes.
// We intentionally do NOT depend on the `web-push` npm package, since it
// relies on Node-only `crypto` APIs that are not guaranteed to exist in
// the Cloudflare Workers runtime this app deploys to.
//
// SECURITY: this file must never be imported from client/browser code.
// It reads the VAPID private key from server-only environment variables.
// Load it inside server handlers / *.server.ts modules only.

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // base64url
  auth: string; // base64url
}

export interface WebPushResult {
  ok: boolean;
  status: number;
  /** Set when the push service says the subscription is gone and should be removed. */
  shouldRemove: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// base64url helpers (no Buffer/atob dependency, safe on any runtime)
// ---------------------------------------------------------------------------

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64Url(bytes: Uint8Array): string {
  let base64 = "";
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    base64 += B64_CHARS[(n >> 18) & 63]! + B64_CHARS[(n >> 12) & 63]! + B64_CHARS[(n >> 6) & 63]! + B64_CHARS[n & 63]!;
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i]! << 16;
    base64 += B64_CHARS[(n >> 18) & 63]! + B64_CHARS[(n >> 12) & 63]!;
  } else if (rem === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    base64 += B64_CHARS[(n >> 18) & 63]! + B64_CHARS[(n >> 12) & 63]! + B64_CHARS[(n >> 6) & 63]!;
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(input: string): Uint8Array {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// VAPID keys (server-side env)
// ---------------------------------------------------------------------------

export interface VapidConfig {
  publicKey: string; // base64url, uncompressed P-256 point (65 bytes) - safe to expose to clients
  privateKeyPkcs8: string; // base64url PKCS8 DER - NEVER expose to clients
  subject: string; // "mailto:someone@example.com" or "https://example.com"
}

export function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKeyPkcs8 = process.env["VAPID_PRIVATE_KEY_PKCS8"];
  const subject = process.env["VAPID_SUBJECT"] || "mailto:suporte@maskpay.com";

  if (!publicKey || !privateKeyPkcs8) return null;
  return { publicKey, privateKeyPkcs8, subject };
}

let cachedSigningKey: { key: CryptoKey; pkcs8: string } | null = null;

async function importVapidPrivateKey(pkcs8Base64Url: string): Promise<CryptoKey> {
  if (cachedSigningKey && cachedSigningKey.pkcs8 === pkcs8Base64Url) {
    return cachedSigningKey.key;
  }
  const der = base64UrlToBytes(pkcs8Base64Url);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der.buffer as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  cachedSigningKey = { key, pkcs8: pkcs8Base64Url };
  return key;
}

async function buildVapidAuthHeader(endpoint: string, vapid: VapidConfig): Promise<string> {
  const origin = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    aud: origin,
    exp: nowSec + 12 * 60 * 60, // 12h, well under the 24h RFC8292 max
    sub: vapid.subject,
  };

  const encodedHeader = bytesToBase64Url(utf8(JSON.stringify(header)));
  const encodedPayload = bytesToBase64Url(utf8(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await importVapidPrivateKey(vapid.privateKeyPkcs8);
  // Web Crypto's ECDSA sign() returns the raw (r||s) signature format,
  // which is exactly what JWS ES256 requires (not DER).
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    utf8(signingInput).buffer as ArrayBuffer,
  );

  const jwt = `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
  return `vapid t=${jwt}, k=${vapid.publicKey}`;
}

// ---------------------------------------------------------------------------
// RFC 8291 aes128gcm payload encryption
// ---------------------------------------------------------------------------

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, data.buffer as ArrayBuffer);
  return new Uint8Array(sig);
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  return hmacSha256(salt, ikm);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  // Only ever need a single block (length <= 32) for this protocol.
  const block = await hmacSha256(prk, concatBytes(info, new Uint8Array([1])));
  return block.slice(0, length);
}

async function encryptPayload(
  plaintext: Uint8Array,
  subscription: PushSubscriptionKeys,
): Promise<Uint8Array> {
  const uaPublicBytes = base64UrlToBytes(subscription.p256dh); // 65 bytes, uncompressed point
  const authSecret = base64UrlToBytes(subscription.auth); // 16 bytes

  // Ephemeral application-server ECDH key pair (fresh per message).
  const asKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));

  const uaPublicKey = await crypto.subtle.importKey(
    "raw",
    uaPublicBytes.buffer as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  const ecdhSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPublicKey },
    asKeyPair.privateKey,
    256,
  );
  const ecdhSecret = new Uint8Array(ecdhSecretBits);

  // Stage 1: derive a per-subscription IKM from the ECDH secret, salted
  // with the subscription's `auth` secret.
  const prk = await hkdfExtract(authSecret, ecdhSecret);
  const keyInfo = concatBytes(
    utf8("WebPush: info"),
    new Uint8Array([0]),
    uaPublicBytes,
    asPublicRaw,
  );
  const ikm = await hkdfExpand(prk, keyInfo, 32);

  // Stage 2: derive the actual content-encryption key + nonce for this
  // specific message, salted with a fresh random salt.
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk2 = await hkdfExtract(salt, ikm);
  const cekInfo = concatBytes(utf8("Content-Encoding: aes128gcm"), new Uint8Array([0]));
  const nonceInfo = concatBytes(utf8("Content-Encoding: nonce"), new Uint8Array([0]));
  const cekBytes = await hkdfExpand(prk2, cekInfo, 16);
  const nonce = await hkdfExpand(prk2, nonceInfo, 12);

  const cek = await crypto.subtle.importKey("raw", cekBytes.buffer as ArrayBuffer, "AES-GCM", false, [
    "encrypt",
  ]);

  // Single record: plaintext followed by the 0x02 "last record" delimiter.
  const recordPlaintext = concatBytes(plaintext, new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce.buffer as ArrayBuffer }, cek, recordPlaintext.buffer as ArrayBuffer),
  );

  // aes128gcm header: salt(16) || record size(4, BE) || idlen(1) || keyid(idlen)
  const recordSize = 4096;
  const header = new Uint8Array(16 + 4 + 1 + asPublicRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = asPublicRaw.length;
  header.set(asPublicRaw, 21);

  return concatBytes(header, ciphertext);
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

/**
 * Sends a single Web Push message to one subscription. Never throws for
 * expected push-service errors (404/410/etc) — callers should inspect
 * `shouldRemove` and clean up the subscription instead.
 */
export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  payload: PushPayload,
  vapid: VapidConfig,
): Promise<WebPushResult> {
  try {
    const body = await encryptPayload(utf8(JSON.stringify(payload)), subscription);
    const authorization = await buildVapidAuthHeader(subscription.endpoint, vapid);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
        Urgency: "high",
        Authorization: authorization,
      },
      body: body.buffer as ArrayBuffer,
    });

    if (response.ok) {
      return { ok: true, status: response.status, shouldRemove: false };
    }

    // 404/410: the push service says this subscription no longer exists.
    const shouldRemove = response.status === 404 || response.status === 410;
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      shouldRemove,
      error: text || `Push service returned ${response.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      shouldRemove: false,
      error: err instanceof Error ? err.message : "Unknown push error",
    };
  }
}
