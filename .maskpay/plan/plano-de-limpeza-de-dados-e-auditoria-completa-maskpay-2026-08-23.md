# Plano de Limpeza de Dados e Auditoria Completa - MaskPay

Este plano detalha o processo de limpeza de dados de teste e a auditoria de segurança/funcional da plataforma MaskPay, garantindo a integridade do sistema e a preservação do acesso administrativo.

## Processo

1. **Limpeza de Dados (Database Housekeeping)**
    - Identificar e remover todos os registros de teste, preservando o usuário administrador autorizado (`souzaaiosoficial01@gmail.com`).
    - Limpar tabelas: `profiles`, `wallets`, `transactions`, `verification_requests`, `tickets`, `ticket_messages`, `admin_logs`, `api_keys`, `webhooks`.
    - Garantir que buckets de storage (como `kyc-documents`) sejam limpos de arquivos de teste (via lógica se possível ou recomendação).

2. **Auditoria de Backend e Segurança**
    - Verificar RLS (Row Level Security) em todas as tabelas.
    - Auditar funções do banco de dados (`has_role`, `process_internal_transfer`, etc.).
    - Validar permissões de `GRANT` para os papéis `authenticated`, `anon` e `service_role`.
    - Revisar o hardening do acesso administrativo (bloqueio por e-mail e role).

3. **Auditoria de Frontend e UX**
    - Validar fluxos de autenticação e redirecionamento.
    - Testar responsividade mobile (especialmente para iPhone).
    - Verificar integridade visual (fontes, cores, assets).

4. **Teste Funcional Ponta a Ponta**
    - Simular criação de conta, login, KYC, depósito/transferência e suporte.
    - Validar as travas de segurança (ex: KYC obrigatório para funções financeiras).

## Detalhes Técnicos

- **Query SQL de Limpeza**: Executar via `supabase--run_sql`. A query usará subqueries para excluir usuários da `auth.users` que não sejam o admin, o que disparará o `ON DELETE CASCADE` nas tabelas relacionadas no schema `public`.
- **Verificação de Permissões**: Verificar se o usuário `souzaaiosoficial01@gmail.com` possui a role `admin` na tabela `user_roles`.
- **Integridade do Código**: Revisar `src/lib/*.functions.ts` para garantir que não existam mocks ou dados hardcoded que deveriam ser dinâmicos.

## User Review Required

> [!IMPORTANT]
> A limpeza de dados removerá permanentemente todos os usuários e transações criados até agora, exceto o seu acesso administrativo. Você confirma que podemos prosseguir com a execução SQL?

- **Atenção**: O acesso administrativo `souzaaiosoficial01@gmail.com` será o único preservado.
- **Auditoria**: Após a limpeza, o sistema será testado como se fosse um ambiente de produção "zero km".
