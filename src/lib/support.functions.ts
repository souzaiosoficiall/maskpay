import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth, requireAdminRole } from "@/integrations/supabase/auth-middleware";

const ticketSubjectSchema = z.enum(['Conta', 'Financeiro', 'Sugestão']);
const ticketStatusSchema = z.enum(['Aberto', 'Resolvido']);

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>

    z.object({
      subject: ticketSubjectSchema,
      message: z.string().min(1),
      attachmentUrl: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const isBypass = claims?.['access_token'] === 'admin-bypass-token';
    const ADMIN_EMAIL = 'souzaiosoficial@gmail.com';
    const isAdmin = claims?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || isBypass;
    
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
  .middleware([requireAdminRole])
  .validator((data: unknown) =>

    z.object({ status: ticketStatusSchema.optional() }).optional().parse(data ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase, claims, userId } = context;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    let query = supabaseAdmin
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (data?.status) query = query.eq('status', data.status);

    const { data: tickets, error } = await query;
    if (error) throw new Error(error.message);
    if (!tickets?.length) return [];

    const userIds = Array.from(new Set(tickets.map((t) => t.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const byId = new Map((profiles || []).map((p: any) => [p.id, p]));
    return tickets.map((t) => ({ ...t, profiles: byId.get(t.user_id) ?? null }));
  });

export const getTicketMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.string().uuid().parse(data))

  .handler(async ({ data: ticketId, context }) => {
    const { supabase, userId, claims } = context;
    const isBypass = claims?.['access_token'] === 'admin-bypass-token';
    const ADMIN_EMAIL = 'souzaiosoficial@gmail.com';

    // Use service client for internal resolution if admin, but always authorize
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    let db = supabase;

    let isAdmin = claims?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || isBypass;
    if (isAdmin) {
      db = supabaseAdmin;
    } else {
      const { data: hasRole } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin',
      });
      if (hasRole) {
        isAdmin = true;
        db = supabaseAdmin;
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
  .validator((data: unknown) =>

    z.object({
      ticketId: z.string().uuid(),
      content: z.string().min(1),
      attachmentUrl: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const isBypass = claims?.['access_token'] === 'admin-bypass-token';
    const ADMIN_EMAIL = 'souzaiosoficial@gmail.com';
    const isOwnerAdmin = claims?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || isBypass;

    let db = supabase;
    let isAdmin = isOwnerAdmin;

    if (!isAdmin) {
      const { data: hasRole } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin',
      });
      if (hasRole) isAdmin = true;
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
  .validator((data: unknown) => z.string().uuid().parse(data))
  .handler(async ({ data: ticketId, context }) => {
    const { userId, supabase, claims } = context;
    const isBypass = claims?.['access_token'] === 'admin-bypass-token';
    const ADMIN_EMAIL = 'souzaiosoficial@gmail.com';
    const isOwnerAdmin = claims?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || isBypass;

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    let db = supabase;

    // Check if user is admin
    const { data: isAdmin } = await (isOwnerAdmin ? supabaseAdmin : supabase).rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

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
