import { createClient } from '@/lib/supabase/client';
import type { PortalUser, PortalUserFormData, PortalShare, PortalShareFormData } from '@/types/portal.types';
import type { DbPortalUser, DbPortalShare } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

let _client: Awaited<ReturnType<typeof createClient>> | null = null;
async function getClient() {
  if (!_client) _client = await createClient();
  return _client;
}

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const chr = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'mock_hash_' + Math.abs(hash).toString(16).padStart(8, '0');
}

function mapUserRow(row: DbPortalUser): PortalUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    lastLogin: row.last_login,
    active: row.active,
    createdAt: row.created_at,
  };
}

function mapShareRow(row: DbPortalShare): PortalShare {
  return {
    id: row.id,
    portalUserId: row.portal_user_id,
    relatedToType: row.related_to_type,
    relatedToId: row.related_to_id,
    permission: row.permission,
    createdAt: row.created_at,
  };
}

export const portalService = {
  async getUsers(): Promise<PortalUser[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('portal_users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data?.map(mapUserRow) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async createUser(data: PortalUserFormData): Promise<PortalUser> {
    try {
      const supabase = await getClient();
      const dbRow = {
        email: data.email,
        name: data.name,
        password_hash: hashPassword(data.password),
      };
      const { data: inserted, error } = await supabase
        .from('portal_users')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapUserRow(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async toggleUserActive(id: string, active: boolean): Promise<boolean> {
    try {
      const supabase = await getClient();
      const { error } = await supabase
        .from('portal_users')
        .update({ active })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      const supabase = await getClient();
      const { error } = await supabase.from('portal_users').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getShares(portalUserId: string): Promise<PortalShare[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('portal_shares')
        .select('*')
        .eq('portal_user_id', portalUserId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data?.map(mapShareRow) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async shareRecord(data: PortalShareFormData): Promise<PortalShare> {
    try {
      const supabase = await getClient();
      const dbRow = {
        portal_user_id: data.portalUserId,
        related_to_type: data.relatedToType,
        related_to_id: data.relatedToId,
        permission: data.permission,
      };
      const { data: inserted, error } = await supabase
        .from('portal_shares')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapShareRow(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async removeShare(id: string): Promise<boolean> {
    try {
      const supabase = await getClient();
      const { error } = await supabase.from('portal_shares').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
