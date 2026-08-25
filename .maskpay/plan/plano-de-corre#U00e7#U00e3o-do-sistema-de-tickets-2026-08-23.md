# Plano de Correção do Sistema de Tickets

O usuário relatou um erro "Bucket not found" ao tentar abrir um ticket. O sistema tenta fazer upload de anexos para o bucket `ticket-attachments` no Supabase Storage, mas o bucket não estava criado.

## Alterações Propostas

### Backend (Supabase/Database)

1.  **Criação do Bucket**: Já executei a criação do bucket `ticket-attachments` como privado via ferramenta de armazenamento.
2.  **Políticas RLS**: Apliquei as políticas de segurança para permitir que usuários autenticados possam fazer upload e visualizar seus próprios anexos.
3.  **Permissões de Tabela**: Garantir que as tabelas `tickets` e `ticket_messages` tenham os GRANTs necessários para a função `authenticated`.

### Frontend

1.  **Tratamento de Erros**:
    *   Melhorar o feedback visual quando o upload de arquivo falha.
    *   Garantir que o sistema admin consiga visualizar os anexos enviados pelos usuários.
2.  **Refatoração do Componente de Suporte**:
    *   Adicionar suporte a anexos no painel administrativo (`SupportCenter.tsx`), que atualmente não parece lidar com `attachment_url`.
    *   Corrigir a função de resposta no admin para também permitir anexos se necessário.

## Detalhes Técnicos

*   **Arquivo**: `src/routes/_authenticated.support.tsx`
    *   Ajustar a lógica de `uploadFile` para lidar com erros de forma mais graciosa.
*   **Arquivo**: `src/components/admin/SupportCenter.tsx`
    *   Adicionar a exibição de imagens enviadas nos tickets dentro da visualização do administrador.
*   **SQL**:
    ```sql
    GRANT ALL ON public.tickets TO authenticated;
    GRANT ALL ON public.ticket_messages TO authenticated;
    GRANT ALL ON public.tickets TO service_role;
    GRANT ALL ON public.ticket_messages TO service_role;
    ```

## Próximos Passos

1.  Aplicar os GRANTs nas tabelas de tickets.
2.  Atualizar o componente `SupportCenter.tsx` para mostrar anexos.
3.  Testar o fluxo completo de criação de ticket com e sem anexo.
