import { createFileRoute } from '@tanstack/react-router';
import { createHmac, timingSafeEqual } from 'crypto';

export const Route = createFileRoute('/api/public/payment-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const bodyText = await request.text();
          const signature = request.headers.get('x-evopay-signature');
          const WEBHOOK_SECRET = process.env['EVOPAY_WEBHOOK_SECRET'];

          // 1. Signature validation (Mandatory for production)
          if (!WEBHOOK_SECRET || !signature) {
             console.error("[Webhook] Missing secret or signature");
             return new Response('Unauthorized', { status: 401 });
          }

          const hmac = createHmac('sha256', WEBHOOK_SECRET);
          const expected = hmac.update(bodyText).digest('hex');
          
          if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            console.error("[Webhook] Invalid signature");
            return new Response('Invalid signature', { status: 401 });
          }

          const payload = JSON.parse(bodyText);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // 2. Process according to provider event type
          const providerId = payload.id || payload.transaction_id || payload.request_id || payload.transactionId;
          const status = (payload.status || payload.event || payload.type || '').toLowerCase();

          if (['paid', 'payment.confirmed', 'completed', 'success', 'approved', 'paid_out'].includes(status)) {
            const { data: existingTx } = await (supabaseAdmin
              .from('transactions')
              .select('id, status, wallet_id, amount, type') as any)
              .eq('provider_id', providerId)
              .maybeSingle();

            if (existingTx && (existingTx as any).status === 'pending') {
              // Update transaction status
              await (supabaseAdmin
                .from('transactions')
                .update({ 
                  status: 'completed',
                  external_status: status 
                } as any) as any)
                .eq('id', (existingTx as any).id);

              // Only add to balance for DEPOSITS. 
              // Withdrawals already had balance deducted and locked at request time.
              if ((existingTx as any).type === 'deposit' && (existingTx as any).wallet_id) {
                await supabaseAdmin.rpc('adjust_wallet_balance', {
                  p_wallet_id: (existingTx as any).wallet_id,
                  p_amount: (existingTx as any).amount
                });

                // Push notification: "PIX RECEBIDO! OLHE SEU SALDO".
                // This block only runs once per transaction, because we
                // only get here when the transaction was still 'pending'
                // (guard above) — if the provider redelivers the same
                // webhook event, existingTx.status will already be
                // 'completed' and this whole branch is skipped, so the
                // notification can never be sent twice for the same PIX.
                // A push failure here must NEVER fail the webhook/payment.
                try {
                  const { notifyPixDepositConfirmed } = await import('@/lib/push-send.server');
                  await notifyPixDepositConfirmed((existingTx as any).wallet_id);
                  await (supabaseAdmin
                    .from('transactions')
                    .update({ push_notified_at: new Date().toISOString() } as any) as any)
                    .eq('id', (existingTx as any).id);
                } catch (pushError) {
                  console.error('Push notification error (payment still processed normally):', pushError);
                }
              }
            }
          } else if (status === 'failed' || status === 'rejected' || status === 'canceled') {
             const { data: existingTx } = await (supabaseAdmin
              .from('transactions')
              .select('id, status, wallet_id, amount, type') as any)
              .eq('provider_id', providerId)
              .maybeSingle();

            if (existingTx && (existingTx as any).status === 'pending') {
              await (supabaseAdmin
                .from('transactions')
                .update({ 
                  status: 'failed',
                  external_status: status 
                } as any) as any)
                .eq('id', (existingTx as any).id);

              // If a WITHDRAWAL fails, return the money to the user's wallet
              if ((existingTx as any).type === 'withdrawal' && (existingTx as any).wallet_id) {
                await supabaseAdmin.rpc('adjust_wallet_balance', {
                  p_wallet_id: (existingTx as any).wallet_id,
                  p_amount: (existingTx as any).amount
                });
              }
            }
          }

          return new Response('OK', { status: 200 });
        } catch (error) {
          console.error('Webhook error:', error);
          return new Response('Internal Server Error', { status: 500 });
        }
      }
    }
  }
});
