import { apiClient, tokenUtils } from './apiClient';
import { ENDPOINTS } from '@/constants/endpoints';
import type {
  User, Category, KBArticle, KBArticleCreate,
  Ticket, TicketCreate, TicketUpdate, TicketMessage,
  AIChatResponse, Notification, AnalyticsOverview, AIFeedbackCreate,
  TokenResponse,
} from '@/types';

export { tokenUtils };

export const authAPI = {
  login: async (email: string, password: string): Promise<TokenResponse> => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    const data = await apiClient.post<TokenResponse>(ENDPOINTS.auth.login, form);
    tokenUtils.set(data.access_token);
    return data;
  },

  register: async (name: string, email: string, password: string, role = 'user'): Promise<User> => {
    return apiClient.post<User>(ENDPOINTS.auth.register, { name, email, password, role });
  },

  getProfile: async (): Promise<User> => {
    return apiClient.get<User>(ENDPOINTS.auth.me);
  },

  logout: () => {
    tokenUtils.remove();
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>(ENDPOINTS.auth.forgotPassword, { email });
  },

  resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>(ENDPOINTS.auth.resetPassword, { token, password });
  },
};

export const kbAPI = {
  getCategories: async (): Promise<Category[]> => {
    return apiClient.get<Category[]>(ENDPOINTS.kb.categories);
  },

  createCategory: async (payload: { name: string; description?: string }): Promise<Category> => {
    return apiClient.post<Category>(ENDPOINTS.kb.createCategory, payload);
  },

  getArticles: async (params?: {
    search?: string;
    category_id?: string;
    tag?: string;
    skip?: number;
    limit?: number;
  }): Promise<KBArticle[]> => {
    return apiClient.get<KBArticle[]>(ENDPOINTS.kb.list, params as Record<string, string>);
  },

  getArticle: async (id: string): Promise<KBArticle> => {
    return apiClient.get<KBArticle>(ENDPOINTS.kb.detail(id));
  },

  createArticle: async (payload: KBArticleCreate): Promise<KBArticle> => {
    return apiClient.post<KBArticle>(ENDPOINTS.kb.create, payload);
  },

  updateArticle: async (id: string, payload: Partial<KBArticleCreate>): Promise<KBArticle> => {
    return apiClient.patch<KBArticle>(ENDPOINTS.kb.update(id), payload);
  },

  deleteArticle: async (id: string): Promise<void> => {
    return apiClient.delete(ENDPOINTS.kb.delete(id));
  },
};

export const ticketsAPI = {
  getAll: async (params?: {
    status?: string;
    assigned_to_me?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<Ticket[]> => {
    return apiClient.get<Ticket[]>(ENDPOINTS.tickets.list, params as Record<string, string>);
  },

  getById: async (id: string): Promise<Ticket> => {
    return apiClient.get<Ticket>(ENDPOINTS.tickets.detail(id));
  },

  create: async (payload: TicketCreate): Promise<Ticket> => {
    return apiClient.post<Ticket>(ENDPOINTS.tickets.create, payload);
  },

  update: async (id: string, payload: Partial<TicketUpdate>): Promise<Ticket> => {
    return apiClient.patch<Ticket>(ENDPOINTS.tickets.update(id), payload);
  },

  getMessages: async (ticketId: string): Promise<TicketMessage[]> => {
    return apiClient.get<TicketMessage[]>(ENDPOINTS.tickets.messages(ticketId));
  },

  addMessage: async (
    ticketId: string,
    payload: { message: string; is_internal?: boolean },
  ): Promise<TicketMessage> => {
    return apiClient.post<TicketMessage>(ENDPOINTS.tickets.messages(ticketId), payload);
  },
};

export const aiAPI = {
  chat: async (query: string, sessionId?: string): Promise<AIChatResponse> => {
    return apiClient.post<AIChatResponse>(ENDPOINTS.ai.chat, { query, session_id: sessionId });
  },

  summarize: async (ticketId: string): Promise<{ summary: string; message_count: number }> => {
    return apiClient.post<{ summary: string; message_count: number }>(ENDPOINTS.ai.summarize(ticketId), {});
  },

  draftReply: async (ticketId: string): Promise<{ draft: string; is_ai_generated: boolean }> => {
    return apiClient.post<{ draft: string; is_ai_generated: boolean }>(ENDPOINTS.ai.draft(ticketId), {});
  },

  submitFeedback: async (payload: AIFeedbackCreate): Promise<void> => {
    return apiClient.post(ENDPOINTS.ai.feedback, payload);
  },
};

export const notificationsAPI = {
  getAll: async (unreadOnly = false): Promise<Notification[]> => {
    return apiClient.get<Notification[]>(ENDPOINTS.notifications.list, { unread_only: String(unreadOnly) });
  },

  markRead: async (id: string): Promise<void> => {
    return apiClient.patch(ENDPOINTS.notifications.read(id), {});
  },

  markAllRead: async (): Promise<void> => {
    return apiClient.patch(ENDPOINTS.notifications.readAll, {});
  },
};

export const analyticsAPI = {
  getOverview: async (): Promise<AnalyticsOverview> => {
    return apiClient.get<AnalyticsOverview>(ENDPOINTS.admin.analytics);
  },
};