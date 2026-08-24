import { useState, useCallback } from "react";
import { Loader2, ScanFace } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import maskPlatformAsset from "@/lib/mask-asset";
import { cn } from "@/lib/utils";

const UNLOCK_KEY = "maskpay-app-unlocked";
const CREDENTIAL_ID_KEY = "maskpay-webauthn-credential-id";

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function isPlatformAuthAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Triggers Face ID / fingerprint via WebAuthn platform authenticator.
 * Registers a local credential on first success; asserts on subsequent tries.
 * Falls back to "soft unlock" when the platform does not support biometrics.
 */
async function authenticateWithBiometrics(): Promise<{ ok: boolean; reason?: string }> {
  const available = await isPlatformAuthAvailable();
  if (!available) {
    return { ok: true, reason: "unsupported" };
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const rpId = window.location.hostname;

  try {
    const existingId = window.localStorage.getItem(CREDENTIAL_ID_KEY);

    if (existingId) {
      await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60_000,
          userVerification: "required",
          rpId,
          allowCredentials: [
            {
              type: "public-key",
              id: base64ToBuffer(existingId),
              transports: ["internal"],
            },
          ],
        },
      });
      return { ok: true };
    }

    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "MaskPay", id: rpId },
        user: {
          id: userId,
          name: "maskpay-user",
          displayName: "MaskPay",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;

    if (credential?.rawId) {
      window.localStorage.setItem(CREDENTIAL_ID_KEY, bufferToBase64(credential.rawId));
    }
    return { ok: true };
  } catch (err: any) {
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "AbortError") {
      return { ok: false, reason: "cancelled" };
    }
    console.warn("[AppLock] WebAuthn fallback:", err);
    return { ok: true, reason: "fallback" };
  }
}

export function isAppUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAppUnlocked(): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearAppUnlock(): void {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    // ignore
  }
}

interface AppLockScreenProps {
  onUnlocked: () => void;
}

export function AppLockScreen({ onUnlocked }: AppLockScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authenticateWithBiometrics();
      if (!result.ok) {
        setError(
          result.reason === "cancelled"
            ? "Autenticação cancelada. Tente novamente."
            : "Não foi possível autenticar. Tente novamente."
        );
        return;
      }
      markAppUnlocked();
      onUnlocked();
    } finally {
      setLoading(false);
    }
  }, [onUnlocked]);

  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      clearAppUnlock();
      try {
        window.localStorage.removeItem("maskpay-login-timestamp");
      } catch {
        // ignore
      }
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white select-none overflow-hidden">
      {/* Subtle glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-white/[0.03] blur-[120px] rounded-full" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Logo + name */}
        <div className="mb-16 flex items-center gap-3">
          <img
            src={maskPlatformAsset.url}
            alt="MaskPay"
            className="h-10 w-10 object-contain"
          />
          <span className="text-2xl font-black tracking-tighter uppercase">
            MaskPay
          </span>
        </div>

        {/* Face ID icon */}
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 border border-white/10">
          <ScanFace className="h-10 w-10 text-white" strokeWidth={1.5} />
        </div>

        <h1 className="mb-2 text-center text-2xl font-black tracking-tight uppercase">
          App bloqueado
        </h1>
        <p className="mb-12 max-w-[280px] text-center text-sm leading-relaxed text-white/40 font-medium">
          Confirme com Face ID para voltar à sua conta.
        </p>

        {/* Primary unlock button — white on black, platform style */}
        <button
          type="button"
          onClick={handleUnlock}
          disabled={loading}
          className={cn(
            "flex h-14 w-full items-center justify-center rounded-full bg-white text-black",
            "text-sm font-black uppercase tracking-widest",
            "shadow-xl shadow-white/5 transition-all active:scale-[0.98]",
            "hover:bg-white/90 disabled:opacity-70"
          )}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Desbloquear"
          )}
        </button>

        {error && (
          <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-wider text-red-400">
            {error}
          </p>
        )}

        {/* Logout link */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          className="mt-8 text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors disabled:opacity-50"
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
}
