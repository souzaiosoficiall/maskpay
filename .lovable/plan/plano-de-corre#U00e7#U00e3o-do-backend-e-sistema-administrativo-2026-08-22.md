# Plano de Correção do Backend e Sistema Administrativo

Este plano visa corrigir as falhas de sincronização de dados, lógica de status de usuários e exibição de documentos no painel administrativo, atacando a causa raiz no banco de dados e no fluxo de informações.

## Alterações Técnicas

### 1. Banco de Dados e Segurança (Supabase)
- **Status Padrão**: Alteração via SQL para garantir que novos usuários nasçam com `status = 'pending'`, `kyc_status = 'pending'`, `verification_status = 'unverified'` e `account_route = 'WHITE'`.
- **Bucket KYC**: Criação e configuração do bucket `kyc-documents` como privado, com políticas de RLS que permitem:
    - Usuários: Apenas upload em sua própria pasta (`auth.uid()`).
    - Administradores: Leitura de todos os documentos para análise.
- **Grants**: Correção de permissões para garantir que funções do servidor (TanStack) e o cliente administrativo funcionem corretamente em todas as tabelas.

### 2. Fluxo de Cadastro e Perfil
- **Sincronização**: Ajuste na criação de perfil durante o cadastro (`auth.tsx`) e na função `getProfile` para garantir que dados como CPF/CNPJ, Telefone e Nome sejam salvos corretamente e não apareçam como "Não informado".
- **Status Inicial**: Garantia de que NENHUMA lógica automática mude o status para 'ativo' sem intervenção humana.

### 3. Verificação de Identidade (KYC)
- **Associação de Arquivos**: Correção no `submitVerification` para garantir que o registro no banco aponte para os caminhos reais no storage associados ao ID do usuário.
- **Visualização no Admin**:
    - Substituição de URLs públicas por URLs assinadas (seguras) temporárias geradas no momento da visualização.
    - Exibição individual dos 3 documentos (Frente, Verso, Selfie).
    - Ajuste nos filtros para identificar usuários com solicitações pendentes mesmo que o status do perfil ainda não tenha sido atualizado.

### 4. Rota Administrativa
- **Privacidade**: Remoção de máscaras de dados sensíveis (como CPF completo) para administradores autorizados.
- **Consistência**: Alinhamento de enums entre frontend e backend (`pending_review`).

## Testes de Validação
1. Criar novo usuário e verificar se nasce como `WHITE` e `PENDENTE`.
2. Enviar documentos de teste e confirmar se aparecem no Admin (Frente, Verso e Selfie).
3. Verificar se campos como Documento e Telefone aparecem sem o texto "Não informado".
4. Aprovar usuário no Admin e confirmar a liberação das funcionalidades.
