import type { Company } from '@/types/company.types';

export function searchCompanies(companies: Company[], query: string): Company[] {
  const s = query.toLowerCase();
  return companies.filter(
    (c) =>
      c.name.toLowerCase().includes(s) ||
      c.industry?.toLowerCase().includes(s) ||
      c.location?.toLowerCase().includes(s)
  );
}
