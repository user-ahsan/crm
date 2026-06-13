import { contacts } from '@/data/contacts';
import { activities } from '@/data/activities';
import type { Contact, ContactFormData } from '@/types/contact.types';
import { generateId } from '@/lib/formatters';

export const contactService = {
  getAll(): Contact[] {
    return [...contacts];
  },

  getById(id: string): Contact | undefined {
    return contacts.find((c) => c.id === id);
  },

  getByCompanyId(companyId: string): Contact[] {
    return contacts.filter((c) => c.companyId === companyId);
  },

  getByLeadId(leadId: string): Contact[] {
    return contacts.filter((c) => c.leadIds.includes(leadId));
  },

  search(query: string): Contact[] {
    const s = query.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.tags.some((t) => t.toLowerCase().includes(s))
    );
  },

  create(data: ContactFormData): Contact {
    const now = new Date().toISOString();
    const newContact: Contact = {
      ...data,
      id: `contact-${generateId().slice(0, 8)}`,
      leadIds: [],
      socialLinks: data.socialLinks || [],
      tags: data.tags || [],
      createdAt: now,
      updatedAt: now,
    };
    contacts.unshift(newContact);
    activities.push({
      id: `act-${generateId().slice(0, 8)}`,
      entityType: 'contact',
      entityId: newContact.id,
      type: 'created',
      description: `Contact created: ${newContact.name}`,
      timestamp: now,
    });
    return newContact;
  },

  update(id: string, data: Partial<ContactFormData>): Contact | undefined {
    const index = contacts.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    const updated = {
      ...contacts[index],
      ...data,
      tags: data.tags ?? contacts[index].tags,
      socialLinks: data.socialLinks ?? contacts[index].socialLinks,
      updatedAt: new Date().toISOString(),
    };
    contacts[index] = updated;
    activities.push({
      id: `act-${generateId().slice(0, 8)}`,
      entityType: 'contact',
      entityId: id,
      type: 'updated',
      description: `Contact updated: ${updated.name}`,
      timestamp: new Date().toISOString(),
    });
    return updated;
  },

  delete(id: string): boolean {
    const index = contacts.findIndex((c) => c.id === id);
    if (index === -1) return false;
    const deleted = contacts[index];
    contacts.splice(index, 1);
    activities.push({
      id: `act-${generateId().slice(0, 8)}`,
      entityType: 'contact',
      entityId: id,
      type: 'deleted',
      description: `Contact deleted: ${deleted.name}`,
      timestamp: new Date().toISOString(),
    });
    return true;
  },

  linkToLead(contactId: string, leadId: string): Contact | undefined {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return undefined;
    if (!contact.leadIds.includes(leadId)) {
      contact.leadIds.push(leadId);
      contact.updatedAt = new Date().toISOString();
    }
    return contact;
  },
};
