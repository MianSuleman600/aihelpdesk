/* ============================================================
   Utility helpers
   ============================================================ */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

/** Merge tailwind class names safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format ISO date to relative time (e.g. "2 hours ago") */
export function timeAgo(date: string): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return date;
  }
}

/** Format ISO date to readable string */
export function formatDate(date: string, fmt = "MMM d, yyyy"): string {
  try {
    return format(new Date(date), fmt);
  } catch {
    return date;
  }
}

/** Format ISO date with time */
export function formatDateTime(date: string): string {
  return formatDate(date, "MMM d, yyyy · h:mm a");
}

/** Truncate text with ellipsis */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + "…";
}

/** Get initials from name */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Strip HTML tags for plain text preview */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}
