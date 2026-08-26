import { createFileRoute } from '@tanstack/react-router';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * EvoPay payment callback.
 * Credits NET amount on confirmed deposits; never double-credits.
 */
export const Route = createFileRoute('/api/public/payment-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const bodyText = await request.text();
          const signature =
            request.headers.get('x-evopay-signature') ||
            request.headers.get('X-EvoPay-Signature') ||
            request.headers.get('x-webhook-signature') ||
            '';

          const WEBHOOK_SECRET = process.env['EVOPAY_WEBHOOK_SECRET'];
          const isProd =
            process.env['NODE_ENV'] === 'production' ||
            process.env['VERCEL_ENV'] === 'production';

          if (WEBHOOK_SECRET) {
            if (!signature) {
              console.error('[Webhook] Missing signature header');
              return new Response('Unauthorized', { status: 401 });
            }
            const rawSig = signature.replace(/^sha256=/i, '').trim();
            const expected = createHmac('sha256', WEBHOOK_SECRET)
              .update(bodyText)
              .digest('hex');
            const sigBuf = Buffer.from(rawSig);
            const expBuf = Buffer.from(expected);
            if (
              sigBuf.length !== expBuf.length ||
              !timingSafeEqual(sigBuf, expBuf)
            ) {
              console.error('[Webhook] Invalid signature');
              return new Response('Invalid signature', { status: 401 });
            }
          } else if (isProd) {
            console.error(
              '[Webhook] EVOPAY_WEBHOOK_SECRET missing in production — rejecting',
            );
            return new Response('Webhook secret not configured', {
              status: 503,
            });
          } else {
            console.warn(
              '[Webhook] EVOPAY_WEBHOOK_SECRET not set — skipping signature check (dev only)',
            );
          }

          let payload: any;
          try {
            payload = JSON.parse(bodyText);
          } catch {
            console.error('[Webhook] Invalid JSON body');
            return new Response('Bad Request', { status: 400 });
          }

          console.log('[Webhook] Received', {
            keys: Object.keys(payload || {}),
            status: payload?.status,
            event: payload?.event || payload?.type,
            id: payload?.id,
            clientReference: payload?.clientReference || payload?.client_reference,
            nestedKeys: payload?.data ? Object.keys(payload.data) : [],
          });

          const { supabaseAdmin } = await import(
            '@/integrations/supabase/client.server'
          );

          // Flatten nested envelopes: { data: {...} } or { transaction: {...} }
          const data =
            payload?.data && typeof payload.data === 'object'
              ? { ...payload, ...payload.data }
              : payload?.transaction && typeof payload.transaction === 'object'
                ? { ...payload, ...payload.transaction }
                : payload;

          const providerIdCandidates = [
            data.id,
            data.transaction_id,
            data.transactionId,
            data.request_id,
            data.provider_id,
            data.pixId,
            data.pix_id,
            payload.id,
            payload.transaction_id,
            payload.transactionId,
          ].filter(Boolean).map(String);

          const clientReferenceCandidates = [
            data.clientReference,
            data.client_reference,
            data.external_id,
            data.externalId,
            data.reference,
            payload.clientReference,
            payload.client_reference,
          ].filter(Boolean).map(String);

          const statusRaw = String(
            data.status ||
              data.payment_status ||
              data.paymentStatus ||
              payload.status ||
              payload.event ||
              payload.type ||
              '',
          ).toLowerCase();

          const paidStatuses = new Set([
            'paid',
            'payment.confirmed',
            'payment.paid',
            'transaction.completed',
            'transaction.funded',
            'transaction_paid',
            'completed',
            'success',
            'approved',
            'paid_out',
            'confirmed',
            'done',
            'liquidated',
            'received',
            'settled',
            'credited',
          ]);

          const failedStatuses = new Set([
            'failed',
            'rejected',
            'canceled',
            'cancelled',
            'error',
            'expired',
            'refunded',
            'chargeback',
          ]);

          const findTx = async () => {
            // 1) by provider_id
            for (const pid of providerIdCandidates) {
              const { data: row } = await (
                supabaseAdmin.from('transactions') as any
              )
                .select(
                  'id, status, wallet_id, amount, net_amount, fee_amount, type, metadata, provider_id',
                )
                .eq('provider_id', pid)
                .maybeSingle();
              if (row) return row;
            }
            // 2) by our internal id === clientReference
            for (const cref of clientReferenceCandidates) {
              const uuidLike =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                  cref,
                );
              if (!uuidLike) continue;
              const { data: row } = await (
                supabaseAdmin.from('transactions') as any
              )
                .select(
                  'id, status, wallet_id, amount, net_amount, fee_amount, type, metadata, provider_id',
                )
                .eq('id', cref)
                .maybeSingle();
              if (row) return row;
            }
            // 3) provider id used as our id (legacy)
            for (const pid of providerIdCandidates) {
              const uuidLike =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                  pid,
                );
              if (!uuidLike) continue;
              const { data: row } = await (
                supabaseAdmin.from('transactions') as any
              )
                .select(
                  'id, status, wallet_id, amount, net_amount, fee_amount, type, metadata, provider_id',
                )
                .eq('id', pid)
                .maybeSingle();
              if (row) return row;
            }
            return null;
          };

          const existingTx = await findTx();

          if (!existingTx) {
            console.warn('[Webhook] Transaction not found', {
              providerIdCandidates,
              clientReferenceCandidates,
              statusRaw,
            });
            // 200 so provider does not retry forever on unknown ids
            return new Response('OK', { status: 200 });
          }

          const tx = existingTx as any;

          // Persist provider_id if we only matched by clientReference
          if (
            !tx.provider_id &&
            providerIdCandidates[0] &&
            providerIdCandidates[0] !== String(tx.id)
          ) {
            await (supabaseAdmin.from('transactions') as any)
              .update({ provider_id: providerIdCandidates[0] })
              .eq('id', tx.id);
          }

          if (paidStatuses.has(statusRaw)) {
            if (tx.status === 'pending') {
              await (supabaseAdmin.from('transactions') as any)
                .update({
                  status: 'completed',
                  external_status: statusRaw,
                })
                .eq('id', tx.id);

              if (tx.type === 'deposit' && tx.wallet_id) {
                const credit =
                  Number(tx.net_amount) > 0
                    ? Number(tx.net_amount)
                    : Math.max(
                        0,
                        Number(tx.amount || 0) - Number(tx.fee_amount || 0),
                      );

                console.log('[Webhook] Crediting deposit', {
                  txId: tx.id,
                  credit,
                  wallet_id: tx.wallet_id,
                });

                await supabaseAdmin.rpc('adjust_wallet_balance', {
                  p_wallet_id: tx.wallet_id,
                  p_amount: credit,
                });

                try {
                  const meta = tx.metadata || {};
                  const orderId = meta.checkout_order_id;
                  if (orderId) {
                    await (supabaseAdmin.from('checkout_orders') as any)
                      .update({ status: 'paid' })
                      .eq('id', orderId);
                  }
                } catch (orderErr) {
                  console.error('[Webhook] checkout_orders update failed:', orderErr);
                }

                try {
                  const { notifyPixDepositConfirmed } = await import(
                    '@/lib/push-send.server'
                  );
                  const origin =
                    data.payerName ||
                    data.payer_name ||
                    data.customer?.name ||
                    data.endToEndId ||
                    data.end_to_end_id ||
                    tx.description ||
                    'PIX';
                  await notifyPixDepositConfirmed(tx.wallet_id, {
                    amount: Number(tx.amount),
                    origin: String(origin),
                  });
                  await (supabaseAdmin.from('transactions') as any)
                    .update({ push_notified_at: new Date().toISOString() })
                    .eq('id', tx.id);
                } catch (pushError) {
                  console.error(
                    'Push notification error (payment still processed):',
                    pushError,
                  );
                }
              }
            } else {
              console.log('[Webhook] Already processed', {
                txId: tx.id,
                status: tx.status,
              });
            }
          } else if (failedStatuses.has(statusRaw)) {
            if (tx.status === 'pending') {
              await (supabaseAdmin.from('transactions') as any)
                .update({
                  status: 'failed',
                  external_status: statusRaw,
                })
                .eq('id', tx.id);

              // Withdrawals were already debited — refund
              if (tx.type === 'withdrawal' && tx.wallet_id) {
                await supabaseAdmin.rpc('adjust_wallet_balance', {
                  p_wallet_id: tx.wallet_id,
                  p_amount: Number(tx.amount || 0),
                });
              }
            }
          } else {
            console.log('[Webhook] Ignoring non-final status', { statusRaw, txId: tx.id });
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
