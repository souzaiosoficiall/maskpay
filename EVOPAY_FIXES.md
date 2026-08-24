# Correções EvoPay (2026-08-24)

## O que estava errado
1. Payload do depósito usava `callback_url` / `external_id` / `merchant_id` (snake_case).
   A API oficial espera **camelCase**: `callbackUrl`, `clientReference`.
2. Extração do QR Code só olhava poucos nomes de campo.
3. Webhook bloqueava tudo se `EVOPAY_WEBHOOK_SECRET` não estivesse setado.
4. Saque falhava e não estornava o saldo bloqueado.

## Arquivos alterados
- `src/lib/payments.functions.ts` — payload oficial + extração de QR + estorno no saque
- `src/lib/evopay-client.server.ts` — logs melhores + mensagens de erro da API
- `src/routes/api/public/payment-webhook.ts` — assinatura opcional + match por clientReference
- `.env` — comentários de configuração

## O que você precisa configurar no ambiente (NÃO no frontend)
```
EVOPAY_API_TOKEN=seu_token_aqui
SITE_URL=https://seu-dominio-publico.com
EVOPAY_WEBHOOK_SECRET=  # opcional, se a Evo assinar
```

Token: https://processamento.evopay.cash/settings/tokens  
Permissões: **DEPOSIT** (depósito) e **WITHDRAW** (saque).

## Como testar
1. Suba o projeto com `EVOPAY_API_TOKEN` no servidor.
2. Gere um depósito de R$ 1,00.
3. Veja os logs `[Audit]` — deve aparecer `Success .../pix/` e as keys da resposta.
4. Se der erro 400/422, a mensagem agora inclui o detalhe retornado pela Evo.
