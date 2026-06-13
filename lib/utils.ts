import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const NORMALIZE_PHONE_REGEX = /\D/g;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizePhone(phone: string): string {
  return phone.replace(NORMALIZE_PHONE_REGEX, '').slice(-10);
}

export function fuzzyNameMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na.length < 3 || nb.length < 3) return na === nb;
  return na.slice(0, 3) === nb.slice(0, 3) && na.slice(-3) === nb.slice(-3);
}

export interface DuplicateMatcher<T> {
  key: keyof T | ((item: T) => string);
  weight: number;
  type: 'exact' | 'fuzzy' | 'normalized';
}

export interface DuplicateGroup<T> {
  item: T;
  duplicates: T[];
  score: number;
}

export function findDuplicates<T extends { id: string }>(
  items: T[],
  matchers: DuplicateMatcher<T>[],
  minScore = 25,
): DuplicateGroup<T>[] {
  const groups: DuplicateGroup<T>[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    if (visited.has(items[i].id)) continue;
    const a = items[i];
    const matches: T[] = [];
    let maxScore = 0;

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (visited.has(b.id)) continue;
      let score = 0;

      for (const matcher of matchers) {
        let valA: string;
        let valB: string;

        if (typeof matcher.key === 'function') {
          valA = matcher.key(a);
          valB = matcher.key(b);
        } else {
          valA = String(a[matcher.key] ?? '');
          valB = String(b[matcher.key] ?? '');
        }

        if (!valA || !valB) continue;

        let matched = false;
        switch (matcher.type) {
          case 'exact':
            matched = valA.toLowerCase() === valB.toLowerCase();
            break;
          case 'normalized':
            matched = normalizePhone(valA) === normalizePhone(valB) && normalizePhone(valA).length >= 10;
            break;
          case 'fuzzy':
            matched = fuzzyNameMatch(valA, valB);
            break;
        }

        if (matched) score += matcher.weight;
      }

      if (score >= minScore) {
        matches.push(b);
        if (score > maxScore) maxScore = score;
      }
    }

    if (matches.length > 0) {
      groups.push({ item: a, duplicates: matches, score: maxScore });
      for (const m of matches) visited.add(m.id);
      visited.add(a.id);
    }
  }

  return groups.sort((a, b) => b.score - a.score);
}
