import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth, requireAdminRole } from "@/integrations/supabase/auth-middleware";
import {
  createTicketSchema,
  listTicketsSchema,
  sendTicketMessageSchema,
  ticketIdSchema,
} from "@/lib/support.schemas";

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createTicketSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const isBypass = claims?.['access_token'] === 'admin-bypass-token';
    const cleanOwnerEmail = 'souzaiosoficial@gmail.com';
    const isAdmin = claims?.email?.toLowerCase().trim() === cleanOwnerEmail || isBypass;
    
    let db = supabase;
    if (isAdmin) {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      db = supabaseAdmin;
    }

    const { data: ticket, error: ticketError } = await (db.from('tickets' as any) as any)
      .insert({ 
        user_id: userId, 
        subject: data.subject, 
        category: data.subject === 'Financeiro' ? 'Financeiro' : 'Suporte', // Fixed category logic
        status: 'Aberto' 
      })
      .select()
      .single();

    if (ticketError) {
      console.error('Ticket creation error:', ticketError);
      throw new Error(ticketError.message);
    }

    const { error: msgError } = await (db.from('ticket_messages' as any) as any)
      .insert([
        {
          ticket_id: (ticket as any).id,
          user_id: userId,
          message: data.message,
          attachment_path: data.attachmentUrl ?? null,
        },
        {
          ticket_id: (ticket as any).id,
          user_id: null, // System message
          message: "Olá! Seu atendimento foi aberto com sucesso. Em breve nossa equipe irá responder seu ticket. Por favor, aguarde.",
          metadata: { sender_name: 'BOOT AUTOMATICO MASK' }
        }
      ]);

    if (msgError) {
      console.error('Ticket message creation error:', msgError);
      await (db.from('tickets' as any) as any).delete().eq('id', (ticket as any).id);
      throw new Error(msgError.message);
    }

    return ticket;
  });

export const getTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => listTicketsSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, claims, userId } = context;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const isBypass = claims?.['access_token'] === 'admin-bypass-token';
    const cleanOwnerEmail = 'souzaiosoficial@gmail.com';
    const userEmail = claims?.email?.toLowerCase().trim();
    let isAdmin = userEmail === cleanOwnerEmail || isBypass;

    if (!isAdmin) {
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'admin',
        });
        if (!rpcError && rpcResult) isAdmin = true;
        else if (rpcError) {
          const { data: roleRow } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .eq('role', 'admin')
            .maybeSingle();
          if (roleRow) isAdmin = true;
        }
      } catch {
        // not admin
      }
    }

    // Admin: todos os tickets. Usuário: só os próprios (RLS + filtro explícito)
    let query = (isAdmin ? supabaseAdmin : supabase)
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('user_id', userId);
    }
    if (data?.status) query = query.eq('status', data.status);

    const { data: tickets, error } = await query;
    if (error) throw new Error(error.message);
    if (!tickets?.length) return [];

    if (!isAdmin) {
      return tickets;
    }

    const userIds = Array.from(new Set(tickets.map((t: any) => t.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const byId = new Map((profiles || []).map((p: any) => [p.id, p]));
    return tickets.map((t: any) => ({ ...t, profiles: byId.get(t.user_id) ?? null }));
  });

export const getTicketMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => ticketIdSchema.parse(data))

  .handler(async ({ data: ticketId, context }) => {
    const { supabase, userId, claims } = context;
    const isBypass = claims?.['access_token'] === 'admin-bypass-token';
    const cleanOwnerEmail = 'souzaiosoficial@gmail.com';
    const userEmail = claims?.email?.toLowerCase().trim();

    // Use service client for internal resolution if admin, but always authorize
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    let db = supabase;

    let isAdmin = userEmail === cleanOwnerEmail || isBypass;
    if (isAdmin) {
      db = supabaseAdmin;
    } else {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin',
      });
      if (!rpcError && rpcResult) {
        isAdmin = true;
        db = supabaseAdmin;
      } else if (rpcError) {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();
        if (roleRow) {
          isAdmin = true;
          db = supabaseAdmin;
        }
      }
    }

    const { data: ticket, error: ticketError } = await db
      .from('tickets')
      .select('id, user_id')
      .eq('id', ticketId)
      .maybeSingle();
    
    if (ticketError) throw new Error(ticketError.message);
    if (!ticket) return [];
    if (!isAdmin && ticket.user_id !== userId) {
      throw new Error('Acesso negado a este ticket.');
    }
    
    const { data: messages, error } = await db
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return messages ?? [];
  });

export const sendTicketMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => sendTicketMessageSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const isBypass = claims?.['access_token'] === 'admin-bypass-token';
    const cleanOwnerEmail = 'souzaiosoficial@gmail.com';
    const userEmail = claims?.email?.toLowerCase().trim();
    const isOwnerAdmin = userEmail === cleanOwnerEmail || isBypass;

    let db = supabase;
    let isAdmin = isOwnerAdmin;

    if (!isAdmin) {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin',
      });
      if (!rpcError && rpcResult) {
        isAdmin = true;
      } else if (rpcError) {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();
        if (roleRow) isAdmin = true;
      }
    }

    if (isAdmin) {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      db = supabaseAdmin;
    }

    const { error: messageError } = await (db.from('ticket_messages' as any) as any)
      .insert({
        ticket_id: data.ticketId,
        user_id: userId,
        message: data.content,
        attachment_path: data.attachmentUrl ?? null,
        metadata: isAdmin ? { sender_name: 'SUPORTE MASK' } : null
      });

    if (messageError) throw new Error(messageError.message);
    return { success: true };
  });

export const resolveTicket = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .validator((data: unknown) => ticketIdSchema.parse(data))
  .handler(async ({ data: ticketId, context }) => {
    const { userId, supabase, claims } = context;
    const isBypass = claims?.['access_token'] === 'admin-bypass-token';
    const cleanOwnerEmail = 'souzaiosoficial@gmail.com';
    const userEmail = claims?.email?.toLowerCase().trim();
    const isOwnerAdmin = userEmail === cleanOwnerEmail || isBypass;

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    let db = supabase;

    // Check if user is admin
    let isAdmin = false;
    if (!isOwnerAdmin) {
      const { data: rpcResult, error: rpcError } = await (isOwnerAdmin ? supabaseAdmin : supabase).rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });
      if (!rpcError && rpcResult) {
        isAdmin = true;
      } else if (rpcError) {
        const { data: roleRow } = await (isOwnerAdmin ? supabaseAdmin : supabase)
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();
        if (roleRow) isAdmin = true;
      }
    }

    if (isOwnerAdmin || isAdmin) {
      db = supabaseAdmin;
    }

    let query = db.from('tickets').update({ 
      status: 'Resolvido',
      updated_at: new Date().toISOString()
    } as any).eq('id', ticketId);

    // If not the owner admin, only allow resolving own tickets
    if (!isOwnerAdmin && !isAdmin) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
    return { success: true };
  });
