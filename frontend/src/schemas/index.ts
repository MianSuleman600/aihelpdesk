import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['user', 'agent', 'admin']).default('user'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const createTicketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  category_id: z.string().optional(),
});

export const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assigned_to_id: z.string().optional(),
  category_id: z.string().optional(),
});

export const createTicketMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  is_internal: z.boolean().default(false),
});

export const createArticleSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  body: z.string().min(20, 'Content must be at least 20 characters'),
  category_id: z.string().optional(),
  tags: z.array(z.string()).default([]),
  is_published: z.boolean().default(false),
});

export const updateArticleSchema = createArticleSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});

export const aiFeedbackSchema = z.object({
  context_type: z.enum(['chat', 'ticket']),
  context_id: z.string().optional(),
  query: z.string(),
  response: z.string(),
  rating: z.enum(['helpful', 'unhelpful']),
  notes: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type CreateTicketMessageInput = z.infer<typeof createTicketMessageSchema>;
export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type AIFeedbackInput = z.infer<typeof aiFeedbackSchema>;