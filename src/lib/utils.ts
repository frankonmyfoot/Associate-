/**
 * Merge class names, filtering out falsy values.
 * Simple utility for conditional class merging.
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format a date string for display.
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Generate a unique ID (simple implementation for prototyping).
 */
export function generateId(): string {
  return crypto.randomUUID();
}