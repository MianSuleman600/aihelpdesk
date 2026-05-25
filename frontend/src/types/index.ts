/* ============================================================
   Type definitions for the AI Helpdesk Portal
   ============================================================ */

// --- Enums ---
export type UserRole = "admin" | "agent" | "user";
export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type Priority = "low" | "medium" | "high";
export type FeedbackRating = "helpful" | "unhelpful";

// --- User ---
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// --- Auth ---
export interface LoginRequest {
  username: string; // email (OAuth2 form field)
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// --- Category ---
export interface Category {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  created_at: string;
}

// --- KB Article ---
export interface KBArticle {
  id: string;
  title: string;
  body: string;
  category_id?: string | null;
  tags: string[];
  created_by_id: string;
  is_published: boolean;
  view_count: number;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KBArticleCreate {
  title: string;
  body: string;
  category_id?: string;
  tags?: string[];
  is_published?: boolean;
}

// --- Ticket ---
export interface UserBrief {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  category_id?: string | null;
  created_by_id: string;
  assigned_to_id?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  created_by?: UserBrief | null;
  assigned_to?: UserBrief | null;
}

export interface TicketCreate {
  subject: string;
  description: string;
  priority?: Priority;
  category_id?: string;
}

export interface TicketUpdate {
  status?: TicketStatus;
  priority?: Priority;
  assigned_to_id?: string;
  category_id?: string;
}

export interface TicketAssign {
  assigned_to_id: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_internal: boolean;
  is_ai_draft: boolean;
  created_at: string;
  sender_name?: string | null;
}

// --- AI Chat ---
export interface ChatSession {
  id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AIChatSource[];
  created_at: string;
}

export interface AIChatSource {
  article_id: string;
  title: string;
  relevance_score: number;
  snippet: string;
}

export interface AIChatResponse {
  answer: string;
  sources: AIChatSource[];
  confidence: number;
  session_id: string;
  suggest_ticket: boolean;
}

// --- Notification ---
export interface Notification {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

// --- Analytics ---
export interface AnalyticsOverview {
  total_tickets: number;
  open_tickets: number;
  resolved_tickets: number;
  avg_resolution_hours: number;
  total_articles: number;
  ai_satisfaction_percent: number;
  tickets_by_status: Record<string, number>;
  tickets_by_category: Record<string, number>;
  ai_feedback_summary: { helpful: number; unhelpful: number };
}

// --- Documents (RAG Uploads) ---
export type DocumentStatus = "processing" | "ready" | "failed";

export interface UploadedDocument {
  id: string;
  title: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
  error_message?: string | null;
  chunk_count: number;
  uploaded_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: UploadedDocument[];
  total: number;
  limit: number;
  max_documents: number;
}

// --- Settings ---
export interface UserSettings {
  notification_email: boolean;
  notification_browser: boolean;
  notification_ticket_updates: boolean;
}

export interface UserSettingsUpdate {
  notification_email?: boolean;
  notification_browser?: boolean;
  notification_ticket_updates?: boolean;
}

// --- AI Feedback ---
export interface AIFeedbackCreate {
  context_type: "chat" | "ticket";
  context_id?: string;
  query: string;
  response: string;
  rating: FeedbackRating;
  notes?: string;
}
