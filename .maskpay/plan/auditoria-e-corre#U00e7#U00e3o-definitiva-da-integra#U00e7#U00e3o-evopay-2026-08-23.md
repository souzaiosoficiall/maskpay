# Auditoria e Correção Definitiva da Integração EvoPay

O usuário relata que a geração de PIX está falhando com a mensagem "ERRO VINDO DA RESPOSTA DA ADQUIRENTE". O objetivo é realizar uma auditoria completa no fluxo, identificar o erro real retornado pela API da EvoPay e corrigir a integração seguindo a documentação oficial.

## Auditoria e Diagnóstico
- Identificar falhas no endpoint, headers (Authorization) e payload (amount em Reais, não centavos).
- Implementar logs detalhados (status HTTP, corpo da resposta) no backend para visibilidade real do erro.
- Garantir que o token seja usado exclusivamente no servidor via `process.env`.

## Alterações Técnicas

### 1. Centralização da Lógica de Rede e Log (Backend)
- Criar `src/lib/evopay-client.server.ts` para encapsular todas as chamadas `fetch` para a EvoPay.
- Implementar log seguro que captura o `status` e `body` da resposta da API em caso de erro, sem expor o token.

### 2. Correção da Geração de Depósito Pix
- Atualizar `generatePixDeposit` em `src/lib/payments.functions.ts`:
  - Usar endpoint: `POST https://api.evopay.cash/v1/pix/` (Remover `/cash-in` se for o caso).
  - Garantir header `Authorization: Bearer <TOKEN>`.
  - Validar payload: `amount` como float/number (ex: 10.00).
  - Usar `clientReference` (ou `external_id`) único para cada tentativa.
  - Retornar QR Code e Copia e Cola reais do objeto de resposta (`qrCodeText`, `qrCodeBase64`, etc).

### 3. Melhoria no Tratamento de Erros
- Mapear códigos HTTP da EvoPay (400, 401, 403, 422, 429, 5xx) para mensagens de erro internas logáveis e amigáveis no frontend.

### 4. Revisão do Webhook
- Garantir que `src/routes/api/public/payment-webhook.ts` suporte o formato de payload da EvoPay para confirmação de pagamento.

### 5. Verificação do Ambiente
- Validar se `EVOPAY_API_TOKEN` está presente no ambiente de execução do servidor.

## Plano de Testes
- Gerar uma cobrança real de R$ 1,00 e inspecionar o log do servidor para confirmar o sucesso ou a causa exata da falha.
