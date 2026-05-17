/* ============================================================
   Application-wide constants
   ============================================================ */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const APP_NAME = 'HelpDesk AI';

export const TICKET_STATUS_CONFIG: Record<string, { label: string; colorClass: string; bgClass: string }> = {
  open: { label: 'Open', colorClass: 'text-brand-400', bgClass: 'bg-brand-500/20' },
  in_progress: { label: 'In Progress', colorClass: 'text-accent-400', bgClass: 'bg-accent-500/20' },
  waiting: { label: 'Waiting', colorClass: 'text-accent-300', bgClass: 'bg-accent-500/20' },
  resolved: { label: 'Resolved', colorClass: 'text-success', bgClass: 'bg-success/20' },
  closed: { label: 'Closed', colorClass: 'text-on-surface-variant', bgClass: 'bg-surface-variant' },
};

export const PRIORITY_CONFIG: Record<string, { label: string; colorClass: string; bgClass: string }> = {
  low: { label: 'Low', colorClass: 'text-success', bgClass: 'bg-success/20' },
  medium: { label: 'Medium', colorClass: 'text-accent-400', bgClass: 'bg-accent-500/20' },
  high: { label: 'High', colorClass: 'text-danger', bgClass: 'bg-danger/20' },
};

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Knowledge Base', href: '/dashboard/kb', icon: 'BookOpen' },
  { label: 'AI Assistant', href: '/dashboard/ai-chat', icon: 'Sparkles' },
  { label: 'My Tickets', href: '/dashboard/tickets', icon: 'Ticket' },
  { label: 'Notifications', href: '/dashboard/notifications', icon: 'Bell' },
] as const;

export const ADMIN_NAV_ITEMS = [
  { label: 'Analytics', href: '/dashboard/admin', icon: 'BarChart3' },
  { label: 'Manage Users', href: '/dashboard/admin/users', icon: 'Users' },
  { label: 'Manage KB', href: '/dashboard/admin/kb', icon: 'FileEdit' },
] as const;