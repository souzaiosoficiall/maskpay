# Plano de Melhoria do Sistema de Suporte

Ajuste e refinamento do sistema de tickets existente para incluir chat completo entre usuário e suporte, histórico persistente, mensagens automáticas e sincronização em tempo real.

## Alterações Técnicas

### 1. Backend (`src/lib/support.functions.ts`)
- **Mensagem Automática**: Modificar `createTicket` para inserir automaticamente a primeira mensagem do remetente **BOOT AUTOMATICO MASK** com o texto padrão: *"Olá! Seu atendimento foi aberto com sucesso. Em breve nossa equipe irá responder seu ticket. Por favor, aguarde."*.
- **Identificação de Remetente**: Refinar `sendTicketMessage` para lidar com a distinção entre usuário comum e administrador, salvando as informações necessárias para renderização correta (quem enviou).

### 2. Interface do Usuário (`src/routes/_authenticated.support.tsx`)
- **Layout de Chat**: Ajustar o posicionamento das mensagens:
  - Mensagens do Usuário: Lado direito, cor de destaque.
  - Mensagens do Suporte/Admin: Lado esquerdo, cor neutra/secundária.
- **Nomes de Exibição**: 
  - Admin/Suporte -> **SUPORTE MASK** ou **BOOT AUTOMATICO MASK**.
  - Usuário -> Nome real do perfil ou "Você".
- **Persistência**: Garantir que o `useQuery` de mensagens utilize o histórico completo do banco e mantenha o estado durante a navegação.

### 3. Painel Administrativo (`src/components/admin/SupportCenter.tsx`)
- **Cronologia**: Exibir mensagens em ordem cronológica (mais antigas primeiro, subindo).
- **Consistência Visual**: Aplicar o mesmo padrão de chat do usuário (Usuário à esquerda, Admin à direita ou vice-versa, mantendo clareza).
- **Nome de Admin**: Garantir que as respostas enviadas pelo admin apareçam como **SUPORTE MASK** para o usuário.

### 4. Banco de Dados (Via código)
- Verificar e garantir que a tabela `ticket_messages` possui os campos `ticket_id`, `user_id`, `message` (ou `content`), `created_at` e `attachment_path`.

## Experiência do Usuário (UX)
- Ao abrir o ticket, o usuário vê instantaneamente a saudação do robô.
- As bolhas de conversa facilitam a leitura do histórico.
- Sincronização automática a cada 3 segundos (polled via React Query) ou tempo real.
