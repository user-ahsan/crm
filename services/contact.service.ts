import { contacts as mockContacts } from '@/data/contacts';
import type { Contact, ContactFormData } from '@/types/contact.types';
import type { DbContact } from '@/types/supabase.types';
import { generateId } from '@/lib/formatters';
import { isSupabaseConfigured, getSupabaseClient as getSupabaseClientAsync, formatSupabaseError, addLocalActivity } from './supabase.service';

function mapRowToContact(row: DbContact): Contact {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    jobTitle: row.job_title ?? undefined,
    companyId: row.company_id ?? undefined,
    leadIds: row.lead_ids ?? [],
    location: row.location ?? undefined,
    socialLinks: row.social_links ?? [],
    tags: row.tags ?? [],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapContactToDb(contact: Partial<ContactFormData>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (contact.name !== undefined) db.name = contact.name;
  if (contact.email !== undefined) db.email = contact.email || null;
  if (contact.phone !== undefined) db.phone = contact.phone || null;
  if (contact.jobTitle !== undefined) db.job_title = contact.jobTitle || null;
  if (contact.companyId !== undefined) db.company_id = contact.companyId || null;
  if (contact.location !== undefined) db.location = contact.location || null;
  if (contact.socialLinks !== undefined) db.social_links = contact.socialLinks;
  if (contact.tags !== undefined) db.tags = contact.tags;
  if (contact.notes !== undefined) db.notes = contact.notes || null;
  return db;
}

export const contactService = {
  async getAll(): Promise<Contact[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbContact[] | null)?.map(mapRowToContact) ?? [];
    }
    return [...mockContacts];
  },

  async getById(id: string): Promise<Contact | undefined> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(formatSupabaseError(error));
      }
      return data ? mapRowToContact(data as DbContact) : undefined;
    }
    return mockContacts.find((c) => c.id === id);
  },

  async getByCompanyId(companyId: string): Promise<Contact[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbContact[] | null)?.map(mapRowToContact) ?? [];
    }
    return mockContacts.filter((c) => c.companyId === companyId);
  },

  async getByLeadId(leadId: string): Promise<Contact[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .contains('lead_ids', [leadId])
        .order('created_at', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbContact[] | null)?.map(mapRowToContact) ?? [];
    }
    return mockContacts.filter((c) => c.leadIds.includes(leadId));
  },

  async search(query: string): Promise<Contact[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const s = query.toLowerCase();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .or(`name.ilike.%${s}%,email.ilike.%${s}%`)
        .order('created_at', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      return (data as DbContact[] | null)?.map(mapRowToContact) ?? [];
    }
    const s = query.toLowerCase();
    return mockContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.tags.some((t) => t.toLowerCase().includes(s)),
    );
  },

  async create(data: ContactFormData): Promise<Contact> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const dbRow = {
        ...mapContactToDb(data),
        id: crypto.randomUUID(),
        lead_ids: [],
        created_at: now,
        updated_at: now,
      };
      const { data: inserted, error } = await supabase
        .from('contacts')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(formatSupabaseError(error));
      return mapRowToContact(inserted as DbContact);
    }
    const newContact: Contact = {
      ...data,
      id: `contact-${generateId().slice(0, 8)}`,
      leadIds: [],
      socialLinks: data.socialLinks || [],
      tags: data.tags || [],
      createdAt: now,
      updatedAt: now,
    };
    mockContacts.unshift(newContact);
    addLocalActivity('contact', newContact.id, 'created', `Contact created: ${newContact.name}`);
    return newContact;
  },

  async update(id: string, data: Partial<ContactFormData>): Promise<Contact | undefined> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const dbData = { ...mapContactToDb(data), updated_at: now };
      const { data: updated, error } = await supabase
        .from('contacts')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(formatSupabaseError(error));
      }
      return mapRowToContact(updated as DbContact);
    }
    const index = mockContacts.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    const updated = {
      ...mockContacts[index],
      ...data,
      tags: data.tags ?? mockContacts[index].tags,
      socialLinks: data.socialLinks ?? mockContacts[index].socialLinks,
      updatedAt: now,
    };
    mockContacts[index] = updated;
    addLocalActivity('contact', id, 'updated', `Contact updated: ${updated.name}`);
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw new Error(formatSupabaseError(error));
      return true;
    }
    const index = mockContacts.findIndex((c) => c.id === id);
    if (index === -1) return false;
    const deleted = mockContacts[index];
    mockContacts.splice(index, 1);
    addLocalActivity('contact', id, 'deleted', `Contact deleted: ${deleted.name}`);
    return true;
  },

  async linkToLead(contactId: string, leadId: string): Promise<Contact | undefined> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data: contact, error: fetchError } = await supabase
        .from('contacts')
        .select('lead_ids')
        .eq('id', contactId)
        .single();
      if (fetchError) {
        if (fetchError.code === 'PGRST116') return undefined;
        throw new Error(formatSupabaseError(fetchError));
      }
      const currentLeadIds: string[] = (contact as { lead_ids: string[] } | null)?.lead_ids ?? [];
      if (currentLeadIds.includes(leadId)) {
        return this.getById(contactId);
      }
      const { data: updated, error: updateError } = await supabase
        .from('contacts')
        .update({ lead_ids: [...currentLeadIds, leadId], updated_at: new Date().toISOString() })
        .eq('id', contactId)
        .select()
        .single();
      if (updateError) throw new Error(formatSupabaseError(updateError));
      return mapRowToContact(updated as DbContact);
    }
    const contact = mockContacts.find((c) => c.id === contactId);
    if (!contact) return undefined;
    if (!contact.leadIds.includes(leadId)) {
      contact.leadIds.push(leadId);
      contact.updatedAt = new Date().toISOString();
    }
    return contact;
  },
};
