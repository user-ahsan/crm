import { createClient } from '@/lib/supabase/client';
import type { ApiKey, ApiKeyFormData, ApiKeyCreateResponse } from '@/types/api-key.types';
import type { DbApiKey } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

let _client: Awaited<ReturnType<typeof createClient>> | null = null;
async function getClient() {
  if (!_client) _client = await createClient();
  return _client;
}

function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const raw = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const fullKey = 'sk_' + raw;
  const prefix = fullKey.slice(0, 12);
  const hash = sha256(fullKey);
  return { fullKey, prefix, hash };
}

function sha256(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function mapRow(row: DbApiKey): ApiKey {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export const apiKeyService = {
  async getKeys(): Promise<ApiKey[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data?.map(mapRow) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async create(data: ApiKeyFormData): Promise<ApiKeyCreateResponse> {
    try {
      const supabase = await getClient();
      const { fullKey, prefix, hash } = generateApiKey();
      const dbRow = {
        name: data.name,
        key_prefix: prefix,
        key_hash: hash,
        scopes: data.scopes,
        expires_at: data.expiresAt ?? null,
        created_by: 'system',
      };
      const { data: inserted, error } = await supabase
        .from('api_keys')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { key: mapRow(inserted), fullKey };
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getClient();
      const { error } = await supabase.from('api_keys').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async regenerate(id: string): Promise<ApiKeyCreateResponse> {
    try {
      const supabase = await getClient();
      const { fullKey, prefix, hash } = generateApiKey();
      const { data: updated, error } = await supabase
        .from('api_keys')
        .update({ key_prefix: prefix, key_hash: hash })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { key: mapRow(updated), fullKey };
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
