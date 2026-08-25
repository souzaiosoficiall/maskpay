# Integração Adquirente EvoPay (Produção)

O objetivo é conectar a plataforma à adquirente EvoPay para processamento real de pagamentos Pix (Depósitos e Saques), eliminando o modo de simulação atual. As credenciais serão configuradas via variáveis de ambiente, garantindo que o projeto funcione após o deploy no Vercel/GitHub.

## Alterações

### Configuração e Segurança
- Adicionar suporte para `EVOPAY_API_TOKEN` e `EVOPAY_MERCHANT_ID` no ambiente.
- O token enviado pelo usuário será configurado via ferramenta de `secrets`.

### Fluxo de Depósito (EvoPay API)
- Modificar `src/lib/payments.functions.ts` para que, na presença do token, a chamada à EvoPay seja obrigatória e falhe caso não obtenha um QR Code real.
- Garantir que a `callback_url` enviada para a EvoPay utilize o domínio real da aplicação para receber webhooks.

### Fluxo de Saque (Cash-out API)
- Implementar a chamada real ao endpoint de cash-out da EvoPay.
- Adicionar validação de saldo bloqueado durante o processamento do saque para evitar gastos duplos.

### Melhorias no Webhook
- Refinar o `src/routes/api/public/payment-webhook.ts` para lidar com os payloads específicos da EvoPay.
- Implementar a verificação de assinatura `x-evopay-signature` para segurança.

## Detalhes Técnicos
- O cliente `src/lib/evopay-client.server.ts` já existe e será o ponto central de comunicação.
- Variáveis de ambiente necessárias:
    - `EVOPAY_API_TOKEN`: Token de autenticação Bearer.
    - `EVOPAY_MERCHANT_ID`: ID do lojista (opcional, dependendo do endpoint).
    - `EVOPAY_WEBHOOK_SECRET`: Chave para validar assinaturas dos webhooks.
- A função `adjust_wallet_balance` no banco de dados será usada para garantir atomicidade no crédito/débito de valores.

## Revisão de Segurança
- As chaves nunca serão expostas no código-fonte (Git).
- Somente o backend (Server Functions) terá acesso aos tokens.
- O middleware de Admin protege as configurações de taxas que afetam os cálculos de pagamento.
