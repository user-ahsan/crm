import { getSharedClient } from '@/lib/supabase/client';
import type { ApiKey, ApiKeyFormData, ApiKeyCreateResponse } from '@/types/api-key.types';
import type { DbApiKey } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';

async function sha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  // Check for Edge runtime compatibility
  if (typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined') {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: use Web Crypto API via dynamic import (Node.js)
  const { createHash } = await import('crypto');
  return createHash('sha256').update(str).digest('hex');
}

async function generateApiKey(): Promise<{ fullKey: string; prefix: string; hash: string }> {
  const raw = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const fullKey = 'sk_' + raw;
  const prefix = fullKey.slice(0, 12);
  const hash = await sha256(fullKey);
  return { fullKey, prefix, hash };
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
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw toServiceError(error);
      return data?.map(mapRow) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async create(data: ApiKeyFormData): Promise<ApiKeyCreateResponse> {
    try {
      const supabase = await getSharedClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { fullKey, prefix, hash } = await generateApiKey();
      const dbRow = {
        name: data.name,
        key_prefix: prefix,
        key_hash: hash,
        scopes: data.scopes,
        expires_at: data.expiresAt ?? null,
        created_by: user?.id ?? 'system',
      };
      const { data: inserted, error } = await supabase
        .from('api_keys')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw toServiceError(error);
      return { key: mapRow(inserted), fullKey };
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.from('api_keys').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async regenerate(id: string): Promise<ApiKeyCreateResponse> {
    try {
      const supabase = await getSharedClient();
      const { fullKey, prefix, hash } = await generateApiKey();
      const { data: updated, error } = await supabase
        .from('api_keys')
        .update({ key_prefix: prefix, key_hash: hash })
        .eq('id', id)
        .select()
        .single();
      if (error) throw toServiceError(error);
      return { key: mapRow(updated), fullKey };
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
