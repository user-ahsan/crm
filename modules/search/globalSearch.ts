import type { Lead } from '@/types/lead.types';
import type { Contact } from '@/types/contact.types';
import type { Company } from '@/types/company.types';
import type { Task } from '@/types/task.types';
import type { Meeting } from '@/types/meeting.types';

export interface SearchResult {
  id: string;
  type: 'lead' | 'contact' | 'company' | 'task' | 'meeting';
  title: string;
  subtitle: string;
  href: string;
}

export function globalSearch(
  query: string,
  leads: Lead[],
  contacts: Contact[],
  companies: Company[],
  tasks: Task[],
  meetings: Meeting[]
): SearchResult[] {
  if (!query || query.trim().length < 1) return [];
  const s = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const lead of leads) {
    if (
      lead.fullName.toLowerCase().includes(s) ||
      lead.email?.toLowerCase().includes(s) ||
      lead.companyName?.toLowerCase().includes(s)
    ) {
      results.push({
        id: lead.id,
        type: 'lead',
        title: lead.fullName,
        subtitle: lead.companyName ? `${lead.companyName} · ${lead.status}` : lead.status,
        href: `/leads/${lead.id}`,
      });
    }
  }

  for (const contact of contacts) {
    if (
      contact.name.toLowerCase().includes(s) ||
      contact.email?.toLowerCase().includes(s) ||
      contact.tags.some((t) => t.toLowerCase().includes(s))
    ) {
      results.push({
        id: contact.id,
        type: 'contact',
        title: contact.name,
        subtitle: contact.jobTitle ?? contact.email ?? 'Contact',
        href: `/contacts/${contact.id}`,
      });
    }
  }

  for (const company of companies) {
    if (
      company.name.toLowerCase().includes(s) ||
      company.industry?.toLowerCase().includes(s) ||
      company.location?.toLowerCase().includes(s)
    ) {
      results.push({
        id: company.id,
        type: 'company',
        title: company.name,
        subtitle: company.industry ?? company.location ?? 'Company',
        href: `/companies/${company.id}`,
      });
    }
  }

  for (const task of tasks) {
    if (task.title.toLowerCase().includes(s) || task.description?.toLowerCase().includes(s)) {
      results.push({
        id: task.id,
        type: 'task',
        title: task.title,
        subtitle: `${task.priority} priority · ${task.status}`,
        href: `/tasks`,
      });
    }
  }

  for (const meeting of meetings) {
    if (meeting.title.toLowerCase().includes(s) || meeting.notes?.toLowerCase().includes(s)) {
      results.push({
        id: meeting.id,
        type: 'meeting',
        title: meeting.title,
        subtitle: new Date(meeting.dateTime).toLocaleDateString(),
        href: `/meetings`,
      });
    }
  }

  return results.slice(0, 20);
}
