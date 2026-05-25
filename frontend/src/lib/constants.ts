/* ============================================================
   Application-wide constants
   ============================================================ */

export { API_BASE_URL } from './apiClient';

export const APP_NAME = 'HelpDesk AI';

export const TICKET_STATUS_CONFIG: Record<string, { label: string; colorClass: string; bgClass: string }> = {
  open: { label: 'Open', colorClass: 'text-primary', bgClass: 'bg-primary/20' },
  in_progress: { label: 'In Progress', colorClass: 'text-primary-light', bgClass: 'bg-primary/15' },
  waiting: { label: 'Waiting', colorClass: 'text-primary-light', bgClass: 'bg-primary/15' },
  resolved: { label: 'Resolved', colorClass: 'text-success', bgClass: 'bg-success/20' },
  closed: { label: 'Closed', colorClass: 'text-on-surface-variant', bgClass: 'bg-surface-container' },
};

export const PRIORITY_CONFIG: Record<string, { label: string; colorClass: string; bgClass: string }> = {
  low: { label: 'Low', colorClass: 'text-success', bgClass: 'bg-success/20' },
  medium: { label: 'Medium', colorClass: 'text-primary-light', bgClass: 'bg-primary/15' },
  high: { label: 'High', colorClass: 'text-danger', bgClass: 'bg-danger/20' },
};

