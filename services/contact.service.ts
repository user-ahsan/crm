import { getSharedClient } from '@/lib/supabase/client';
import type { Contact, ContactFormData } from '@/types/contact.types';
import type { DbContact, ContactInsert } from '@/types/supabase.types';
import { findDuplicates } from '@/lib/utils';
import type { DuplicateGroup } from '@/lib/utils';
import { ServiceError, toServiceError } from './supabase.service';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';
import { automationService } from './automation.service';

/**
 * Filters for `getFiltered()`. Every supplied field is AND-ed with the
 * others. `status` is intentionally absent: the contacts table (F2 schema)
 * has no status column, so filtering on one would throw 42703 on Supabase.
 */
export interface ContactFilters {
  /** Free-text search across name, email, phone, and job title. */
  search?: string;
  companyId?: string;
  leadId?: string;
  /** Tag id — resolved to the tag name stored in contacts.tags. */
  tagId?: string;
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

function mapContactToDb(contact: Partial<ContactFormData>): Partial<ContactInsert> {
  const db: Partial<ContactInsert> = {};
  if (contact.name !== undefined) db.name = contact.name;
  if (contact.email !== undefined) db.email = contact.email || null;
  if (contact.phone !== undefined) db.phone = contact.phone || null;
  if (contact.jobTitle !== undefined) db.job_title = contact.jobTitle || null;
  if (contact.companyId !== undefined) db.company_id = contact.companyId || null;
  if (contact.leadIds !== undefined) db.lead_ids = contact.leadIds;
  if (contact.location !== undefined) db.location = contact.location || null;
  if (contact.socialLinks !== undefined) db.social_links = contact.socialLinks;
  if (contact.tags !== undefined) db.tags = contact.tags;
  if (contact.notes !== undefined) db.notes = contact.notes || null;
  return db;
}

/**
 * Deletes every record related to a contact, scoped by entity type so a
 * same-ID row of a different entity is never touched. Any failure aborts
 * the cascade (throws) — the contact itself is NOT deleted, so no orphans
 * are left behind.
 */
async function deleteRelatedRecords(id: string): Promise<void> {
  const supabase = await getSharedClient();
  const ops = [
    supabase.from('tasks').delete().eq('related_to_id', id).eq('related_to_type', 'contact'),
    supabase.from('meetings').delete().eq('related_to_id', id).eq('related_to_type', 'contact'),
    supabase.from('activities').delete().eq('entity_id', id).eq('entity_type', 'contact'),
    supabase.from('notes').delete().eq('related_to_id', id).eq('related_to_type', 'contact'),
    supabase.from('email_history').delete().eq('related_to_id', id).eq('related_to_type', 'contact'),
    supabase.from('call_logs').delete().eq('related_to_id', id).eq('related_to_type', 'contact'),
    supabase.from('sms_logs').delete().eq('related_to_id', id).eq('related_to_type', 'contact'),
    supabase.from('file_attachments').delete().eq('related_to_id', id).eq('related_to_type', 'contact'),
    supabase.from('taggings').delete().eq('taggable_id', id).eq('taggable_type', 'contact'),
  ];
  const results = await Promise.all(ops);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    throw new ServiceError(
      `Failed to delete related records for contact ${id}: ${failed.error.message}`,
      failed.error.code,
    );
  }
}

/**
 * Re-points every record related to the merged-away contacts onto the
 * survivor, scoped by entity type (tasks, meetings, activities, notes,
 * email history, call logs, sms logs, file attachments, taggings). Any
 * failure throws — the merge aborts before any contact is deleted.
 */
async function repointRelatedRecords(survivorId: string, mergeIds: string[]): Promise<void> {
  const supabase = await getSharedClient();
  const ops = [
    supabase.from('tasks').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'contact'),
    supabase.from('meetings').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'contact'),
    supabase.from('activities').update({ entity_id: survivorId }).in('entity_id', mergeIds).eq('entity_type', 'contact'),
    supabase.from('notes').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'contact'),
    supabase.from('email_history').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'contact'),
    supabase.from('call_logs').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'contact'),
    supabase.from('sms_logs').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'contact'),
    supabase.from('file_attachments').update({ related_to_id: survivorId }).in('related_to_id', mergeIds).eq('related_to_type', 'contact'),
    supabase.from('taggings').update({ taggable_id: survivorId }).in('taggable_id', mergeIds).eq('taggable_type', 'contact'),
  ];
  const results = await Promise.all(ops);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    throw new ServiceError(
      `Failed to re-point related records for contact ${survivorId}: ${failed.error.message}`,
      failed.error.code,
    );
  }
}

export const contactService = {
  async getAll(page = 1, pageSize = 50): Promise<Contact[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      return data?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getById(id: string): Promise<Contact | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data ? mapRowToContact(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getByCompanyId(companyId: string, page = 1, pageSize = 50): Promise<Contact[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      return data?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getByLeadId(leadId: string, page = 1, pageSize = 50): Promise<Contact[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .contains('lead_ids', [leadId])
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      return data?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Free-text search over name/email/phone/job title.
   * Legacy alias of `getFiltered({ search: query })` — kept for callers
   * that used the old undocumented name.
   */
  async search(query: string, page = 1, pageSize = 50): Promise<Contact[]> {
    return this.getFiltered({ search: query }, page, pageSize);
  },

  /**
   * Documented filter API (SERVICES.md). AND semantics: only contacts
   * matching every supplied filter are returned. A search shorter than two
   * characters returns [] (matches the legacy `search` guard).
   */
  async getFiltered(filters: ContactFilters, page = 1, pageSize = 50): Promise<Contact[]> {
    try {
      const supabase = await getSharedClient();
      if (filters.search !== undefined && filters.search.trim().length < 2) return [];

      let query = supabase.from('contacts').select('*');
      if (filters.search) {
        const s = filters.search.trim().toLowerCase();
        query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,job_title.ilike.%${s}%`);
      }
      if (filters.companyId) query = query.eq('company_id', filters.companyId);
      if (filters.leadId) query = query.contains('lead_ids', [filters.leadId]);
      if (filters.tagId) {
        const { data: tagRow, error: tagErr } = await supabase
          .from('tags')
          .select('name')
          .eq('id', filters.tagId)
          .maybeSingle();
        if (tagErr) throw toServiceError(tagErr);
        const rawTagName = tagRow?.name;
        const tagName = typeof rawTagName === 'string' ? rawTagName : undefined;
        // Unknown tag id → no contact can match it.
        if (!tagName) return [];
        query = query.contains('tags', [tagName]);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      return data?.map(mapRowToContact) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async create(data: ContactFormData): Promise<Contact> {
    try {
      const supabase = await getSharedClient();
      const dbRow = {
        ...mapContactToDb(data),
        lead_ids: data.leadIds ?? [],
      };
      const { data: inserted, error } = await supabase
        .from('contacts')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw toServiceError(error);
      const contact = mapRowToContact(inserted);
      activityService.log('contact', contact.id, 'created', `Contact created: ${contact.name}`);
      triggerWebhook('contact.created', {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        companyId: contact.companyId,
      });
      await automationService.evaluate('contact.created', {
        entityType: 'contact',
        entityId: contact.id,
        id: contact.id,
        name: contact.name,
        email: contact.email,
        companyId: contact.companyId,
      });
      return contact;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async update(id: string, data: Partial<ContactFormData>): Promise<Contact | undefined> {
    try {
      const supabase = await getSharedClient();
      const dbData = { ...mapContactToDb(data) };
      const { data: updated, error } = await supabase
        .from('contacts')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      const contact = mapRowToContact(updated);
      activityService.log('contact', id, 'updated', `Contact updated: ${contact.name}`);
      triggerWebhook('contact.updated', { id, ...data });
      await automationService.evaluate('contact.updated', {
        entityType: 'contact',
        entityId: id,
        id: contact.id,
        name: contact.name,
        email: contact.email,
        companyId: contact.companyId,
      });
      return contact;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      await deleteRelatedRecords(id);
      const supabase = await getSharedClient();
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw toServiceError(error);
      activityService.log('contact', id, 'deleted', `Contact deleted`);
      triggerWebhook('contact.deleted', { id });
      await automationService.evaluate('contact.deleted', {
        entityType: 'contact',
        entityId: id,
        id,
      });
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Full-table duplicate scan (no pagination limit) using email, phone,
   * and name matching via the shared lib/utils findDuplicates helper.
   * @see leadService.findDuplicates — same pattern with different weights
   */
  async findDuplicates(threshold?: number): Promise<DuplicateGroup<Contact>[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw toServiceError(error);
      const all = data?.map(mapRowToContact) ?? [];
      return findDuplicates(
        all,
        [
          { key: (c: Contact) => c.email ?? '', weight: 45, type: 'exact' as const },
          { key: (c: Contact) => c.phone ?? '', weight: 40, type: 'normalized' as const },
          { key: (c: Contact) => c.name ?? '', weight: 15, type: 'fuzzy' as const },
        ],
        threshold ?? 25,
      );
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Merges duplicate contacts into one survivor (documented name).
   * Related records (tasks, meetings, activities, notes, email history,
   * call logs, sms logs, file attachments, taggings) are re-pointed to the
   * survivor, lead links are unioned, then the duplicates are deleted with
   * the same scoped cascade as `delete`. Any cascade failure throws before
   * a duplicate is removed.
   */
  async mergeContacts(survivorId: string, mergeIds: string[]): Promise<Contact> {
    try {
      const deduped = [...new Set(mergeIds)].filter((id) => id !== survivorId);

      const survivorBefore = await this.getById(survivorId);
      if (!survivorBefore) {
        throw new ServiceError(`Survivor contact not found: ${survivorId}`, 'CONTACT_NOT_FOUND');
      }
      if (deduped.length === 0) return survivorBefore;

      // Re-point every related record before deleting any duplicate.
      await repointRelatedRecords(survivorId, deduped);

      // Preserve lead links from the merged-away contacts (lead_ids array column).
      const mergedContacts = (await Promise.all(deduped.map((id) => this.getById(id))))
        .filter((c): c is Contact => c !== undefined);
      const unionLeadIds = [...new Set([
        ...survivorBefore.leadIds,
        ...mergedContacts.flatMap((c) => c.leadIds),
      ])];
      const leadIdsChanged = unionLeadIds.length !== survivorBefore.leadIds.length
        || unionLeadIds.some((leadId, index) => leadId !== survivorBefore.leadIds[index]);

      // Remove the merged-away contacts (each cascades its own records).
      for (const id of deduped) {
        await this.delete(id);
      }

      // Apply the lead_ids union as a direct write — a single contact.updated
      // is dispatched below so the merge reports one coherent event.
      let survivor = survivorBefore;
      if (leadIdsChanged) {
        const supabase = await getSharedClient();
        const { data: survivorRow, error: leadErr } = await supabase
          .from('contacts')
          .update({ lead_ids: unionLeadIds })
          .eq('id', survivorId)
          .select()
          .single();
        if (leadErr) throw toServiceError(leadErr);
        survivor = mapRowToContact(survivorRow);
      }

      activityService.log('contact', survivorId, 'updated', `Contact merged: merged ${deduped.length} duplicates`);
      triggerWebhook('contact.updated', {
        id: survivor.id,
        name: survivor.name,
        email: survivor.email,
        companyId: survivor.companyId,
      });
      await automationService.evaluate('contact.updated', {
        entityType: 'contact',
        entityId: survivor.id,
        id: survivor.id,
        name: survivor.name,
        email: survivor.email,
        companyId: survivor.companyId,
      });
      return survivor;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Legacy alias of `mergeContacts` — kept for existing callers
   * (app/settings/data-quality/page-content.tsx).
   */
  async merge(survivorId: string, mergeIds: string[]): Promise<Contact> {
    return this.mergeContacts(survivorId, mergeIds);
  },

  /**
   * Links a contact to a lead by persisting the lead id in the contact's
   * lead_ids array (the contacts table carries the relation). Idempotent —
   * an already-linked lead is left untouched. Returns the updated contact.
   */
  async linkToLead(contactId: string, leadId: string): Promise<Contact | undefined> {
    try {
      const contact = await this.getById(contactId);
      if (!contact) return undefined;
      if (contact.leadIds.includes(leadId)) return contact;
      return this.update(contactId, { leadIds: [...contact.leadIds, leadId] });
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
