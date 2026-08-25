# Plano de Acesso Administrativo e Correção

O objetivo é garantir que o e-mail `souzaiosoficial@gmail.com` tenha acesso administrativo total e resolver o erro de "Credenciais inválidas" que persiste mesmo após a limpeza do banco, garantindo que o usuário possa se cadastrar e ser reconhecido corretamente.

## Ações Técnicas

1. **Correção de Permissões de RLS no Perfil**:
   - Garantir que a tabela `profiles` permita inserções durante o cadastro, mesmo que o usuário ainda não tenha um cargo definido.
   - Ajustar as políticas de RLS para evitar bloqueios na criação do perfil inicial.

2. **Garantia de Cargo Administrativo via Trigger**:
   - Criar uma trigger no banco de dados que atribui automaticamente o cargo 'admin' na tabela `user_roles` assim que o usuário com o e-mail `souzaiosoficial@gmail.com` for criado no `auth.users`.
   - Isso elimina a dependência de funções de servidor para a primeira atribuição de cargo.

3. **Verificação de Fluxo de Cadastro**:
   - Revisar o componente de cadastro para garantir que não existam travas prematuras que impeçam a criação da conta para o e-mail administrativo.

4. **Teste de Registro**:
   - Confirmar que o e-mail não existe no `auth.users` e fornecer o link direto para o cadastro.

## Detalhes de Segurança

- A trava de administrador permanece restrita exclusivamente ao e-mail `souzaiosoficial@gmail.com` no código e agora também via trigger no banco.
- O uso de `service_role` na trigger garante que a atribuição de cargo seja feita independentemente das restrições de RLS do usuário comum.
