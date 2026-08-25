import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "@/lib/utils";
import { randomBytes } from "node:crypto";

function generateClientId(): string {
  return `mask_${randomBytes(8).toString("hex")}`;
}

function generateSecret(): string {
  return `sk_live_${randomBytes(24).toString("hex")}`;
}

/** List keys for the logged-in user (never returns the raw secret). */
export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase.from("api_keys") as any)
      .select("id, key_name, scopes, created_at, last_used_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[listApiKeys]", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      clientId: row.key_name as string,
      scopes: row.scopes as string[],
      createdAt: row.created_at as string,
      lastUsedAt: (row.last_used_at as string | null) ?? null,
    }));
  });

/**
 * Create a new API key pair.
 * Returns the secret ONCE — only the SHA-256 hash is stored.
 */
export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        label: z.string().max(80).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clientId = generateClientId();
    const secret = generateSecret();
    const keyHash = await sha256Hex(`${clientId}:${secret}`);

    const { data: row, error } = await (supabase.from("api_keys") as any)
      .insert({
        user_id: userId,
        key_name: clientId,
        key_hash: keyHash,
        scopes: ["read", "write"],
      })
      .select("id, key_name, created_at")
      .single();

    if (error) {
      console.error("[createApiKey]", error);
      throw new Error(error.message || "Falha ao criar chave de API.");
    }

    return {
      id: row.id as string,
      clientId: row.key_name as string,
      secret, // shown only once
      createdAt: row.created_at as string,
      warning:
        "Guarde o Secret agora. Ele não será exibido novamente por segurança.",
    };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase.from("api_keys") as any)
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message || "Falha ao revogar chave.");
    return { success: true };
  });

/**
 * Validate Client ID + Secret for external integrations.
 * Returns userId when valid.
 */
export async function validateApiCredentials(
  clientId: string,
  secret: string,
  supabaseAdmin: any,
): Promise<{ userId: string } | null> {
  if (!clientId || !secret) return null;
  const keyHash = await sha256Hex(`${clientId}:${secret}`);

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id")
    .eq("key_name", clientId)
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !data) return null;

  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { userId: data.user_id as string };
}
