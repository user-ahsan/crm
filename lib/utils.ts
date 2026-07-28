import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ── Email Validation ────────────────────────────────────── */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Phone Normalization ─────────────────────────────────── */
// ponytail: only used internally by findDuplicates — not exported
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}

/* ── Fuzzy Name Match ────────────────────────────────────── */
// ponytail: only used internally by findDuplicates — not exported
function fuzzyNameMatch(a: string, b: string): boolean {
  const normA = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const normB = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normA === normB) return true;
  return normA.includes(normB) || normB.includes(normA);
}

/* ── Duplicate Detection ─────────────────────────────────── */
export interface DuplicateGroup<T> {
  item: T;
  duplicates: T[];
  score: number;
}

interface WeightRule<T> {
  key: (item: T) => string;
  weight: number;
  type: 'exact' | 'fuzzy' | 'normalized';
}

export function findDuplicates<T>(
  items: T[],
  rules: WeightRule<T>[],
  threshold: number,
): DuplicateGroup<T>[] {
  const groups: DuplicateGroup<T>[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (visited.has(i)) continue;

    const group: T[] = [items[i]];
    visited.add(i);

    for (let j = i + 1; j < items.length; j++) {
      if (visited.has(j)) continue;

      let score = 0;
      for (const rule of rules) {
        const valA = rule.key(items[i]);
        const valB = rule.key(items[j]);
        if (!valA || !valB) continue;

        let match = false;
        switch (rule.type) {
          case 'exact':
            match = valA.toLowerCase() === valB.toLowerCase();
            break;
          case 'fuzzy':
            match = fuzzyNameMatch(valA, valB);
            break;
          case 'normalized':
            match = normalizePhone(valA) === normalizePhone(valB);
            break;
        }
        if (match) score += rule.weight;
      }

      if (score >= threshold) {
        group.push(items[j]);
        visited.add(j);
      }
    }

    if (group.length > 1) {
      groups.push({
        item: group[0],
        duplicates: group.slice(1),
        score: threshold,
      });
    }
  }

  return groups;
}
