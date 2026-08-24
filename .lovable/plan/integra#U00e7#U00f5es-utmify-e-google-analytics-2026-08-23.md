# Integrações Utmify e Google Analytics

O objetivo é tornar as integrações com Utmify (via Token) e Google Analytics (via Google ID) funcionais e persistentes no banco de dados para cada usuário.

## Mudanças no Banco de Dados

- Criar uma nova tabela `user_integrations` para armazenar as chaves de integração por usuário.
- Habilitar RLS e permissões de acesso.

## Ações Técnicas

- **Esquema SQL**:
  - Tabela: `public.user_integrations`
  - Colunas: `id (uuid)`, `user_id (uuid)`, `provider (text)`, `config (jsonb)`, `created_at`, `updated_at`.
  - Índices: Único em `(user_id, provider)`.

- **Backend**:
  - Criar `src/lib/integrations.functions.ts` com:
    - `getUserIntegrations`: busca as configurações salvas.
    - `saveIntegration`: salva ou atualiza uma integração (Utmify ou Google).

- **Frontend**:
  - Modificar `src/routes/_authenticated.api-keys.tsx`:
    - Adicionar modais para inserir o Token (Utmify) e Google ID (Google Analytics).
    - Exibir status "Conectado" ou "Não Conectado" com base no banco de dados.
    - Implementar a lógica de salvar e deletar integrações.

## Detalhes Técnicos

- **Utmify**: Solicitar "Token de API".
- **Google Analytics**: Solicitar "Google ID (Mensuração/UA)".
- As chaves serão salvas criptografadas ou em JSONB seguro (acessível apenas pelo proprietário via RLS).

```sql
CREATE TABLE public.user_integrations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    provider text not null,
    config jsonb not null default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_integrations TO authenticated;
GRANT ALL ON public.user_integrations TO service_role;

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own integrations"
ON public.user_integrations
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```
