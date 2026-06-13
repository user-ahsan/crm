import { createClient } from '@/lib/supabase/client';
import type { Contact, ContactFormData } from '@/types/contact.types';
import type { DbContact } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

function fuzzyNameMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na.length < 3 || nb.length < 3) return na === nb;
  return na.slice(0, 3) === nb.slice(0, 3) && na.slice(-3) === nb.slice(-3);
}

interface DuplicateGroup {
  contact: Contact;
  duplicates: Contact[];
  score: number;
}

let _client: Awaited<ReturnType<typeof createClient>> | null = null;
async function getClient() {
  if (!_client) _client = await createClient();
  return _client;
}

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
  async getAll(page = 1, pageSize = 50): Promise<Contact[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getById(id: string): Promise<Contact | undefined> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapRowToContact(data) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getByCompanyId(companyId: string, page = 1, pageSize = 50): Promise<Contact[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getByLeadId(leadId: string, page = 1, pageSize = 50): Promise<Contact[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .contains('lead_ids', [leadId])
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async search(query: string, page = 1, pageSize = 50): Promise<Contact[]> {
    try {
      const supabase = await getClient();
      const s = query.toLowerCase();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .or(`name.ilike.%${s}%,email.ilike.%${s}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async create(data: ContactFormData): Promise<Contact> {
    try {
      const supabase = await getClient();
      const dbRow = {
        ...mapContactToDb(data),
        lead_ids: [],
      };
      const { data: inserted, error } = await supabase
        .from('contacts')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const contact = mapRowToContact(inserted);
      activityService.log('contact', contact.id, 'created', `Contact created: ${contact.name}`);
      triggerWebhook('contact.created', {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        companyId: contact.companyId,
      });
      return contact;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async update(id: string, data: Partial<ContactFormData>): Promise<Contact | undefined> {
    try {
      const supabase = await getClient();
      const dbData = { ...mapContactToDb(data) };
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
      const contact = mapRowToContact(updated);
      activityService.log('contact', id, 'updated', `Contact updated: ${contact.name}`);
      triggerWebhook('contact.updated', { id, ...data });
      return contact;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getClient();
      await supabase.from('tasks').delete().eq('related_to_id', id);
      await supabase.from('meetings').delete().eq('related_to_id', id);
      await supabase.from('activities').delete().eq('entity_id', id);
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw new Error(error.message);
      activityService.log('contact', id, 'deleted', `Contact deleted`);
      triggerWebhook('contact.deleted', { id });
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async findDuplicates(): Promise<DuplicateGroup[]> {
    try {
      const all = await this.getAll();
      const groups: DuplicateGroup[] = [];
      const visited = new Set<string>();

      for (let i = 0; i < all.length; i++) {
        if (visited.has(all[i].id)) continue;
        const a = all[i];
        const matches: Contact[] = [];
        let maxScore = 0;

        for (let j = i + 1; j < all.length; j++) {
          const b = all[j];
          if (visited.has(b.id)) continue;
          let score = 0;

          if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
            score += 45;
          }
          if (a.phone && b.phone) {
            const npA = normalizePhone(a.phone);
            const npB = normalizePhone(b.phone);
            if (npA === npB && npA.length >= 10) {
              score += 40;
            }
          }
          if (a.name && b.name && fuzzyNameMatch(a.name, b.name)) {
            score += 15;
          }

          if (score >= 25) {
            matches.push(b);
            if (score > maxScore) maxScore = score;
          }
        }

        if (matches.length > 0) {
          groups.push({ contact: a, duplicates: matches, score: maxScore });
          for (const m of matches) visited.add(m.id);
          visited.add(a.id);
        }
      }

      return groups.sort((a, b) => b.score - a.score);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async merge(survivorId: string, mergeIds: string[]): Promise<Contact> {
    try {
      const supabase = await getClient();

      await supabase.from('tasks').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'contact');
      await supabase.from('meetings').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'contact');
      await supabase.from('activities').update({ entity_id: survivorId }).in('entity_id', mergeIds);
      await supabase.from('taggings').update({ taggable_id: survivorId }).in('taggable_id', mergeIds).eq('taggable_type', 'contact');

      for (const id of mergeIds) {
        await this.delete(id);
      }

      const survivor = await this.getById(survivorId);
      if (!survivor) throw new Error('Survivor contact not found after merge');
      activityService.log('contact', survivorId, 'updated', `Contact merged: merged ${mergeIds.length} duplicates`);
      return survivor;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async linkToLead(contactId: string, leadId: string): Promise<Contact | undefined> {
    try {
      const supabase = await getClient();
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
        .update({ lead_ids: [...currentLeadIds, leadId] })
        .eq('id', contactId)
        .select()
        .single();
      if (updateError) throw new Error(updateError.message);
      return mapRowToContact(updated);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
