import bcrypt from 'bcryptjs';
import { getSharedClient } from '@/lib/supabase/client';
import type { PortalUser, PortalUserFormData, PortalShare, PortalShareFormData } from '@/types/portal.types';
import type { DbPortalUser, DbPortalShare } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';
import { checkRateLimit } from '@/lib/rate-limit';
import { RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_BCRYPT_COST } from '@/lib/constants';

/**
 * DEPRECATED: Temporary portal authentication bypassing Supabase Auth.
 *
 * This approach stores passwords in the portal_users table with bcrypt
 * hashing instead of using Supabase Auth. This means no MFA support, no
 * built-in password reset flow, no Supabase session management, and no
 * social login capability.
 *
 * ⚠️ Known limitations:
 *   - No multi-factor authentication
 *   - Password resets must be custom-built
 *   - Session management is manual
 *   - Rate limiting is applied inline (not at network level)
 *
 * Future work: Migrate portal users to Supabase Auth identities and
 * remove this entire file.
 */

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, RATE_LIMIT_BCRYPT_COST);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // ponytail: rate limit keyed by a static prefix since portal login
  // has no per-user session yet. Enhance with per-IP or per-email tracking
  // when this runs behind an API route.
  if (!checkRateLimit('portal:verify-password', RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS)) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!PASSWORD_STRENGTH_REGEX.test(password)) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
  }
  return null;
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
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('portal_users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw toServiceError(error);
      return data?.map(mapUserRow) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async createUser(data: PortalUserFormData): Promise<PortalUser> {
    // Validate password strength before creating user
    const passwordError = validatePasswordStrength(data.password);
    if (passwordError) {
      throw new ServiceError(passwordError, 'VALIDATION_ERROR');
    }
    try {
      const supabase = await getSharedClient();
      const dbRow = {
        email: data.email,
        name: data.name,
        password_hash: await hashPassword(data.password),
      };
      const { data: inserted, error } = await supabase
        .from('portal_users')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw toServiceError(error);
      return mapUserRow(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async toggleUserActive(id: string, active: boolean): Promise<PortalUser | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data: updated, error } = await supabase
        .from('portal_users')
        .update({ active })
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return updated ? mapUserRow(updated) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      // Delete associated portal_shares first with error checking
      const { error: sharesErr } = await supabase.from('portal_shares').delete().eq('portal_user_id', id);
      if (sharesErr) {
        console.error(`Delete portal shares error: ${sharesErr.message}`);
        throw toServiceError(sharesErr);
      }
      const { error } = await supabase.from('portal_users').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getShares(portalUserId: string): Promise<PortalShare[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('portal_shares')
        .select('*')
        .eq('portal_user_id', portalUserId)
        .order('created_at', { ascending: false });
      if (error) throw toServiceError(error);
      return data?.map(mapShareRow) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async shareRecord(data: PortalShareFormData): Promise<PortalShare> {
    try {
      const supabase = await getSharedClient();
      // Duplicate check before insert
      const { data: existing } = await supabase
        .from('portal_shares')
        .select('id')
        .eq('portal_user_id', data.portalUserId)
        .eq('related_to_type', data.relatedToType)
        .eq('related_to_id', data.relatedToId)
        .maybeSingle();
      if (existing) {
        // Return existing share instead of creating duplicate
        const { data: existingShare } = await supabase
          .from('portal_shares')
          .select('*')
          .eq('id', existing.id)
          .single();
        if (existingShare) return mapShareRow(existingShare);
      }

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
      if (error) throw toServiceError(error);
      return mapShareRow(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async removeShare(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.from('portal_shares').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
