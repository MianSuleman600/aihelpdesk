import { apiClient, tokenUtils } from './apiClient';
import { ENDPOINTS } from '@/constants/endpoints';
import type {
  User, UserBrief, Category, KBArticle, KBArticleCreate,
  Ticket, TicketCreate, TicketUpdate, TicketAssign, TicketMessage,
  AIChatResponse, Notification, AnalyticsOverview, AIFeedbackCreate,
  TokenResponse, UploadedDocument, DocumentListResponse,
  UserSettings, UserSettingsUpdate,
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

  updateProfile: async (data: { name?: string; email?: string }): Promise<User> => {
    return apiClient.patch<User>(ENDPOINTS.auth.me, data);
  },

  changePassword: async (old_password: string, new_password: string): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>(ENDPOINTS.auth.changePassword, { old_password, new_password });
  },

  deleteAccount: async (): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(ENDPOINTS.auth.me);
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
    category_id?: string;
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

  close: async (id: string): Promise<Ticket> => {
    return apiClient.post<Ticket>(`${ENDPOINTS.tickets.detail(id)}/close`, {});
  },

  reopen: async (id: string): Promise<Ticket> => {
    return apiClient.post<Ticket>(`${ENDPOINTS.tickets.detail(id)}/reopen`, {});
  },

  assign: async (id: string, payload: TicketAssign): Promise<Ticket> => {
    return apiClient.post<Ticket>(`${ENDPOINTS.tickets.detail(id)}/assign`, payload);
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

export const documentsAPI = {
  list: async (): Promise<DocumentListResponse> => {
    return apiClient.get<DocumentListResponse>(ENDPOINTS.documents.list);
  },

  get: async (id: string): Promise<UploadedDocument> => {
    return apiClient.get<UploadedDocument>(ENDPOINTS.documents.detail(id));
  },

  upload: async (file: File): Promise<{ message: string; document: UploadedDocument }> => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post<{ message: string; document: UploadedDocument }>(
      ENDPOINTS.documents.upload,
      form,
    );
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(ENDPOINTS.documents.delete(id));
  },

  reindex: async (id: string): Promise<{ message: string; status: string; chunk_count: number }> => {
    return apiClient.post<{ message: string; status: string; chunk_count: number }>(
      ENDPOINTS.documents.reindex(id), {},
    );
  },
};

export const adminAPI = {
  listUsers: async (search?: string) => {
    return apiClient.get<User[]>(ENDPOINTS.admin.users, search ? { search } as Record<string, string> : undefined);
  },
  toggleUserStatus: async (userId: string) => {
    return apiClient.patch(ENDPOINTS.admin.userToggleStatus(userId), {});
  },
  updateUserRole: async (userId: string, role: string) => {
    return apiClient.patch(`${ENDPOINTS.admin.userRole(userId)}?role=${role}`, {});
  },
  getAgents: async (): Promise<UserBrief[]> => {
    return apiClient.get<UserBrief[]>(`${ENDPOINTS.admin.users}?role=agent`);
  },
};

export const settingsAPI = {
  get: async (): Promise<UserSettings> => {
    return apiClient.get<UserSettings>(ENDPOINTS.settings.get);
  },

  update: async (data: UserSettingsUpdate): Promise<UserSettings> => {
    return apiClient.patch<UserSettings>(ENDPOINTS.settings.update, data);
  },
};

export const analyticsAPI = {
  getOverview: async (period?: string): Promise<AnalyticsOverview> => {
    return apiClient.get<AnalyticsOverview>(ENDPOINTS.admin.analytics, period ? { period } as Record<string, string> : undefined);
  },
};