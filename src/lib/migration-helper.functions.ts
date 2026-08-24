import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const migrateAdminData = createServerFn({ method: "POST" })
  .handler(async () => {
    console.log("Starting admin data migration...");
    
    // 1. Update KYC status in profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        kyc_status: 'pending_review',
        verification_status: 'pending_review',
        status: 'pending_review' 
      })
      .or('kyc_status.eq.pending,verification_status.eq.pending,status.eq.pending');

    if (profileError) console.error("Migration profile error:", profileError);

    // 2. Update verification requests status
    const { error: requestError } = await supabaseAdmin
      .from('verification_requests')
      .update({ status: 'pending_review' })
      .eq('status', 'pending');

    if (requestError) console.error("Migration request error:", requestError);

    return { success: true };
  });
