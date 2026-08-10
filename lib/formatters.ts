import { randomUUID } from 'crypto';

/**
 * Format a numeric value as currency.
 * @param value - The numeric amount.
 * @param currency - ISO 4217 currency code (default 'USD'). Falls back to 'USD' if invalid.
 */
export function formatCurrency(value: number, currency = 'USD'): string {
  const safeCurrency = currency && /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Group an array of { value, currency } items into per-currency totals
 * and format as a readable string like "$100 · €50".
 */
export function formatMultiCurrencyTotals(items: ReadonlyArray<{ value: number; currency: string }>): string {
  const totals = new Map<string, number>();
  for (const item of items) {
    const cur = item.currency && /^[A-Z]{3}$/i.test(item.currency) ? item.currency.toUpperCase() : 'USD';
    totals.set(cur, (totals.get(cur) ?? 0) + item.value);
  }
  if (totals.size === 0) return formatCurrency(0);
  return Array.from(totals, ([cur, val]) => formatCurrency(val, cur)).join(' · ');
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');
  if (diffHour < 24) return rtf.format(-diffHour, 'hour');
  if (diffDay < 7) return rtf.format(-diffDay, 'day');
  if (diffDay < 30) return rtf.format(-Math.floor(diffDay / 7), 'week');

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/** @deprecated Not used in any component. Use `new Date().toISOString()` directly instead. */
export function toISOString(date: Date): string {
  return date.toISOString();
}

export function generateId(): string {
  // Use crypto.randomUUID() on modern browsers/Node 19+
  // Fallback to crypto.getRandomValues for older environments
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Node.js crypto module fallback — import at top of file for tree-shaking
  try {
    return randomUUID();
  } catch {
    // ponytail: last resort — use timestamp + random hex, add when crypto is unavailable
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${Date.now()}-${hex}`;
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** @deprecated Not currently imported by any component. Kept as a shared utility for potential future use. */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/** @deprecated Not currently imported by any component. Kept as a shared utility for potential future use. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural || `${singular}s`;
}
