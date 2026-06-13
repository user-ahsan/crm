import type { Contact } from '@/types/contact.types';

export function searchContacts(contacts: Contact[], query: string): Contact[] {
  const s = query.toLowerCase();
  return contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.tags.some((t) => t.toLowerCase().includes(s)) ||
      c.jobTitle?.toLowerCase().includes(s)
  );
}
