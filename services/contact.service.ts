import { createClient } from '@/lib/supabase/client';
import type { Contact, ContactFormData } from '@/types/contact.types';
import type { DbContact } from '@/types/supabase.types';
import { formatSupabaseError, addLocalActivity } from './supabase.service';

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
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbContact[] | null)?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to fetch contacts');
    }
  },

  async getById(id: string): Promise<Contact | undefined> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapRowToContact(data as DbContact) : undefined;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch contact ${id}`);
    }
  },

  async getByCompanyId(companyId: string): Promise<Contact[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbContact[] | null)?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch contacts for company ${companyId}`);
    }
  },

  async getByLeadId(leadId: string): Promise<Contact[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .contains('lead_ids', [leadId])
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbContact[] | null)?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch contacts for lead ${leadId}`);
    }
  },

  async search(query: string): Promise<Contact[]> {
    try {
      const supabase = await createClient();
      const s = query.toLowerCase();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .or(`name.ilike.%${s}%,email.ilike.%${s}%`)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as DbContact[] | null)?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to search contacts');
    }
  },

  async create(data: ContactFormData): Promise<Contact> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();
      const dbRow = {
        ...mapContactToDb(data),
        lead_ids: [],
        created_at: now,
        updated_at: now,
      };
      const { data: inserted, error } = await supabase
        .from('contacts')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const contact = mapRowToContact(inserted as DbContact);
      addLocalActivity('contact', contact.id, 'created', `Contact created: ${contact.name}`);
      return contact;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to create contact');
    }
  },

  async update(id: string, data: Partial<ContactFormData>): Promise<Contact | undefined> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();
      const dbData = { ...mapContactToDb(data), updated_at: now };
      const { data: updated, error } = await supabase
        .from('contacts')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      const contact = mapRowToContact(updated as DbContact);
      addLocalActivity('contact', id, 'updated', `Contact updated: ${contact.name}`);
      return contact;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to update contact ${id}`);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw new Error(error.message);
      addLocalActivity('contact', id, 'deleted', `Contact deleted`);
      return true;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to delete contact ${id}`);
    }
  },

  async linkToLead(contactId: string, leadId: string): Promise<Contact | undefined> {
    try {
      const supabase = await createClient();
      const { data: contact, error: fetchError } = await supabase
        .from('contacts')
        .select('lead_ids')
        .eq('id', contactId)
        .single();
      if (fetchError) {
        if (fetchError.code === 'PGRST116') return undefined;
        throw new Error(fetchError.message);
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
      if (updateError) throw new Error(updateError.message);
      return mapRowToContact(updated as DbContact);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to link contact ${contactId} to lead ${leadId}`);
    }
  },
};
