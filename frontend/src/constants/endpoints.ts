export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },
  kb: {
    list: '/kb/articles',
    detail: (id: string) => `/kb/articles/${id}`,
    create: '/kb/articles',
    update: (id: string) => `/kb/articles/${id}`,
    delete: (id: string) => `/kb/articles/${id}`,
    categories: '/kb/categories',
    createCategory: '/kb/categories',
    search: '/kb/articles/search',
  },
  tickets: {
    list: '/tickets',
    detail: (id: string) => `/tickets/${id}`,
    create: '/tickets',
    update: (id: string) => `/tickets/${id}`,
    messages: (id: string) => `/tickets/${id}/messages`,
    assign: (id: string) => `/tickets/${id}/assign`,
  },
  ai: {
    chat: '/ai/chat',
    summarize: (ticketId: string) => `/ai/tickets/${ticketId}/summarize`,
    draft: (ticketId: string) => `/ai/tickets/${ticketId}/draft`,
    feedback: '/ai/feedback',
  },
  notifications: {
    list: '/notifications',
    read: (id: string) => `/notifications/${id}/read`,
    readAll: '/notifications/read-all',
  },
  admin: {
    analytics: '/admin/analytics',
    users: '/admin/users',
    userDetail: (id: string) => `/admin/users/${id}`,
  },
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;