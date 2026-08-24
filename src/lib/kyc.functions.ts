import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const submitVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      documentType: z.string(),
      frontPath: z.string(),
      backPath: z.string(),
      selfiePath: z.string(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // 1. Create verification request
    const { error: requestError } = await (supabaseAdmin.from('verification_requests' as any) as any)
      .insert({
        user_id: userId,
        document_type: data.documentType.toLowerCase(),
        front_path: data.frontPath,
        back_path: data.backPath,
        selfie_path: data.selfiePath,
        status: 'pending_review'
      });

    if (requestError) throw new Error(requestError.message);

    // 2. Update KYC flags only — keep account status active
    const { error: profileError } = await (supabaseAdmin.from('profiles' as any) as any)
      .update({ 
        verification_status: 'pending_review',
        kyc_status: 'pending_review',
      })
      .eq('id', userId);

    if (profileError) throw new Error(profileError.message);

    return { success: true };
  });

export const getVerificationRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await context.supabase
      .from('verification_requests')
      .select('id, user_id, status, submitted_at, document_type, front_path, back_path, selfie_path')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  });
