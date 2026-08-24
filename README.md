# MaskPay

Infraestrutura de pagamentos — PWA com PIX, carteira, API keys, webhooks e notificações push.

## Stack

- TanStack Start / React
- Supabase (Auth + Postgres + Storage)
- Vercel (deploy)
- EvoPay (adquirente PIX)

## Desenvolvimento

```bash
npm install
npm run dev
```

Configure as variáveis de ambiente (`.env` / Vercel): Supabase, EvoPay, VAPID.

## Produção

Deploy na Vercel com as env de produção. Webhook PIX:

`https://seu-dominio/api/public/payment-webhook`
