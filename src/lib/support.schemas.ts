import { z } from "zod";

export const ticketSubjectSchema = z.enum(['Conta', 'Financeiro', 'Sugestão']);
export const ticketStatusSchema = z.enum(['Aberto', 'Resolvido']);

export const createTicketSchema = z.object({
  subject: ticketSubjectSchema,
  message: z.string().min(1),
  attachmentUrl: z.string().optional(),
});

export const listTicketsSchema = z.object({ status: ticketStatusSchema.optional() }).optional();

export const sendTicketMessageSchema = z.object({
  ticketId: z.string().uuid(),
  content: z.string().min(1),
  attachmentUrl: z.string().optional(),
});

export const ticketIdSchema = z.string().uuid();
