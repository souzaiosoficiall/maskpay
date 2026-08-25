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

          // Signature validation when secret is configured.
          // If secret is missing, log and continue so early setup still receives credits.
          if (WEBHOOK_SECRET) {
            if (!signature) {
              console.error("[Webhook] Missing x-evopay-signature header");
              return new Response('Unauthorized', { status: 401 });
            }
            const hmac = createHmac('sha256', WEBHOOK_SECRET);
            const expected = hmac.update(bodyText).digest('hex');
            const sigBuf = Buffer.from(signature);
            const expBuf = Buffer.from(expected);
            if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
              console.error("[Webhook] Invalid signature");
              return new Response('Invalid signature', { status: 401 });
            }
          } else {
            console.warn("[Webhook] EVOPAY_WEBHOOK_SECRET not set — skipping signature check");
          }

          const payload = JSON.parse(bodyText);
          console.log("[Webhook] Received payload keys:", Object.keys(payload));
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const providerId =
            payload.id ||
            payload.transaction_id ||
            payload.request_id ||
            payload.transactionId ||
            payload.clientReference ||
            null;

          const status = String(
            payload.status || payload.event || payload.type || ''
          ).toLowerCase();

          // Also match by clientReference if provider_id not found
          const findTx = async () => {
            if (providerId) {
              const byProvider = await (supabaseAdmin
                .from('transactions')
                .select('id, status, wallet_id, amount, net_amount, fee_amount, type') as any)
                .eq('provider_id', providerId)
                .maybeSingle();
              if (byProvider.data) return byProvider.data;

              // Fallback: clientReference may be our internal tx id
              const byId = await (supabaseAdmin
                .from('transactions')
                .select('id, status, wallet_id, amount, net_amount, fee_amount, type') as any)
                .eq('id', providerId)
                .maybeSingle();
              if (byId.data) return byId.data;
            }
            return null;
          };

          const paidStatuses = [
            'paid',
            'payment.confirmed',
            'completed',
            'success',
            'approved',
            'paid_out',
            'confirmed',
            'done',
          ];

          if (paidStatuses.includes(status)) {
            const existingTx = await findTx();

            if (existingTx && (existingTx as any).status === 'pending') {
              await (supabaseAdmin
                .from('transactions')
                .update({
                  status: 'completed',
                  external_status: status,
                } as any) as any)
                .eq('id', (existingTx as any).id);

              if ((existingTx as any).type === 'deposit' && (existingTx as any).wallet_id) {
                // Credit NET amount (after 2.49% + R$ 0,40). Never credit gross amount.
                const credit =
                  Number((existingTx as any).net_amount) > 0
                    ? Number((existingTx as any).net_amount)
                    : Math.max(
                        0,
                        Number((existingTx as any).amount || 0) -
                          Number((existingTx as any).fee_amount || 0),
                      );
                await supabaseAdmin.rpc('adjust_wallet_balance', {
                  p_wallet_id: (existingTx as any).wallet_id,
                  p_amount: credit,
                });

                try {
                  const { notifyPixDepositConfirmed } = await import('@/lib/push-send.server');
                  const origin =
                    payload?.payerName ||
                    payload?.payer_name ||
                    payload?.customer?.name ||
                    payload?.endToEndId ||
                    payload?.end_to_end_id ||
                    (existingTx as any)?.description ||
                    'PIX';
                  await notifyPixDepositConfirmed((existingTx as any).wallet_id, {
                    amount: Number((existingTx as any).amount),
                    origin: String(origin),
                  });
                  await (supabaseAdmin
                    .from('transactions')
                    .update({ push_notified_at: new Date().toISOString() } as any) as any)
                    .eq('id', (existingTx as any).id);
                } catch (pushError) {
                  console.error('Push notification error (payment still processed normally):', pushError);
                }
              }
            }
          } else if (['failed', 'rejected', 'canceled', 'cancelled', 'error'].includes(status)) {
            const existingTx = await findTx();

            if (existingTx && (existingTx as any).status === 'pending') {
              await (supabaseAdmin
                .from('transactions')
                .update({
                  status: 'failed',
                  external_status: status,
                } as any) as any)
                .eq('id', (existingTx as any).id);

              if ((existingTx as any).type === 'withdrawal' && (existingTx as any).wallet_id) {
                await supabaseAdmin.rpc('adjust_wallet_balance', {
                  p_wallet_id: (existingTx as any).wallet_id,
                  p_amount: (existingTx as any).amount,
                });
              }
            }
          }

          return new Response('OK', { status: 200 });
        } catch (error) {
          console.error('Webhook error:', error);
          return new Response('Internal Server Error', { status: 500 });
        }
      },
    },
  },
});
