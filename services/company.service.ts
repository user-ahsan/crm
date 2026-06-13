import { companies } from '@/data/companies';
import { activities } from '@/data/activities';
import type { Company, CompanyFormData } from '@/types/company.types';
import { generateId } from '@/lib/formatters';

export const companyService = {
  getAll(): Company[] {
    return [...companies];
  },

  getById(id: string): Company | undefined {
    return companies.find((c) => c.id === id);
  },

  search(query: string): Company[] {
    const s = query.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.industry?.toLowerCase().includes(s) ||
        c.location?.toLowerCase().includes(s)
    );
  },

  create(data: CompanyFormData): Company {
    const now = new Date().toISOString();
    const newCompany: Company = {
      ...data,
      id: `company-${generateId().slice(0, 8)}`,
      contactIds: [],
      leadIds: [],
      createdAt: now,
      updatedAt: now,
    };
    companies.unshift(newCompany);
    activities.push({
      id: `act-${generateId().slice(0, 8)}`,
      entityType: 'company',
      entityId: newCompany.id,
      type: 'created',
      description: `Company created: ${newCompany.name}`,
      timestamp: now,
    });
    return newCompany;
  },

  update(id: string, data: Partial<CompanyFormData>): Company | undefined {
    const index = companies.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    const updated = {
      ...companies[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    companies[index] = updated;
    activities.push({
      id: `act-${generateId().slice(0, 8)}`,
      entityType: 'company',
      entityId: id,
      type: 'updated',
      description: `Company updated: ${updated.name}`,
      timestamp: new Date().toISOString(),
    });
    return updated;
  },

  delete(id: string): boolean {
    const index = companies.findIndex((c) => c.id === id);
    if (index === -1) return false;
    const deleted = companies[index];
    companies.splice(index, 1);
    activities.push({
      id: `act-${generateId().slice(0, 8)}`,
      entityType: 'company',
      entityId: id,
      type: 'deleted',
      description: `Company deleted: ${deleted.name}`,
      timestamp: new Date().toISOString(),
    });
    return true;
  },

  getRevenueEstimate(): number {
    return companies.reduce((sum, c) => sum + c.revenue, 0);
  },
};
