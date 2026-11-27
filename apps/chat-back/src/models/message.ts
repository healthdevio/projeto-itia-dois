import { z } from 'zod';

export interface Message {
  message_id: string;
  message: string;
  date?: string;
  metadata?: string;
  origin: string;
}

export const messageSchema = z.object({
  message_id: z.string().trim().min(1, 'message_id é obrigatório'),
  message: z.string().trim().min(1, 'message é obrigatório'),
  date: z.string().trim().min(1, 'date não pode ser vazio').optional(),
  metadata: z.string().optional(),
  origin: z.string().trim().min(1, 'origin é obrigatório'),
});
