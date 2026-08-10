import { createClient } from '@supabase/supabase-js';
import { getSharedClient } from '@/lib/supabase/client';
import type { PortalUser, PortalUserFormData, PortalShare, PortalShareFormData } from '@/types/portal.types';
import type { DbPortalUser, DbPortalShare } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';

/**
 * Portal user authentication now uses Supabase Auth instead of bcrypt.
 *
 * - `portal_users` table stores profile metadata (email, name, active status)
 * - `auth.users` (Supabase Auth) manages credentials, sessions, MFA, password resets
 * - Each portal_user.id matches the corresponding auth.users.id
 * - `portal_shares` table remains unchanged for record-level permissions
 *
 * Admin operations (createUser, deleteUser) require SUPABASE_SERVICE_ROLE_KEY
 * and are intended for server-side use only.
 */

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Creates a Supabase admin client using the service role key.
 * Used for admin operations: createUser, deleteUser, toggleUserActive.
 * Throws if the environment variables are missing.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new ServiceError(
      'Supabase admin configuration is incomplete: admin operations require ' +
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      'CONFIG_ERROR',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
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

  /**
   * Creates a portal user with a Supabase Auth identity.
   *
   * 1. Validates password strength client-side
   * 2. Creates the user in auth.users via admin client with the same UUID
   * 3. Inserts a portal_users profile row with matching id
   *
   * Requires SUPABASE_SERVICE_ROLE_KEY — only call from server context.
   */
  async createUser(data: PortalUserFormData): Promise<PortalUser> {
    const passwordError = validatePasswordStrength(data.password);
    if (passwordError) {
      throw new ServiceError(passwordError, 'VALIDATION_ERROR');
    }
    try {
      const adminClient = getAdminClient();
      const supabase = await getSharedClient();

      // Generate a single UUID used for both auth.users and portal_users
      const { data: { user: authUser }, error: authError } = await adminClient.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          name: data.name,
          portal_user: true,
        },
      });
      if (authError) throw toServiceError(authError);
      if (!authUser) throw new ServiceError('Failed to create auth user', 'AUTH_ERROR');

      const dbRow = {
        id: authUser.id,
        email: data.email,
        name: data.name,
      };
      const { data: inserted, error } = await supabase
        .from('portal_users')
        .insert(dbRow)
        .select()
        .single();
      if (error) {
        // Rollback: delete the auth user if portal_users insert fails
        await adminClient.auth.admin.deleteUser(authUser.id).catch(() => {});
        throw toServiceError(error);
      }
      return mapUserRow(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Activates or deactivates a portal user.
   *
   * SERVER-ONLY: syncing the active flag to the Supabase Auth user requires
   * SUPABASE_SERVICE_ROLE_KEY (server-side env). Calling this from a client
   * bundle throws a CONFIG_ERROR instead of silently skipping the auth ban —
   * deactivation MUST NOT pretend to revoke access while the auth user stays
   * able to sign in (P1: portal deactivation silently failed to block
   * sign-in). Client callers (hooks/UI) route through the PATCH endpoint at
   * `app/api/portal/auth/users/[id]/route.ts`, which runs server-side.
   */
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

      // Sync active status to the Supabase Auth user. `getAdminClient()`
      // throws a clear CONFIG_ERROR when the service-role key is absent, and
      // an admin failure here is propagated (never swallowed) so the caller
      // knows the deactivation did not revoke sign-in access.
      const adminClient = getAdminClient();
      if (active) {
        await adminClient.auth.admin.updateUserById(id, { ban_duration: 'none' });
      } else {
        // Ban the user so they cannot sign in
        await adminClient.auth.admin.updateUserById(id, { ban_duration: '365d' });
      }

      return updated ? mapUserRow(updated) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();

      // Delete associated portal_shares first
      const { error: sharesErr } = await supabase.from('portal_shares').delete().eq('portal_user_id', id);
      if (sharesErr) {
        console.error(`Delete portal shares error: ${sharesErr.message}`);
        throw toServiceError(sharesErr);
      }

      // Delete the portal_users row
      const { error } = await supabase.from('portal_users').delete().eq('id', id);
      if (error) throw toServiceError(error);

      // Best-effort: delete the Supabase Auth user
      try {
        const adminClient = getAdminClient();
        await adminClient.auth.admin.deleteUser(id);
      } catch {
        // Auth user deletion failure is non-critical if row is already gone
      }

      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Authenticates a portal user via Supabase Auth.
   * Returns the session and user data on success.
   */
  async authenticatePortalUser(email: string, password: string): Promise<{
    session: { accessToken: string; refreshToken: string; expiresAt: number };
    user: PortalUser;
  }> {
    try {
      const supabase = await getSharedClient();

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        if (authError.status === 429) {
          throw new ServiceError('Too many login attempts. Please try again later.', 'RATE_LIMITED', 429);
        }
        throw new ServiceError(authError.message, 'AUTH_ERROR', authError.status ?? 401);
      }
      if (!authData.user || !authData.session) {
        throw new ServiceError('Authentication failed', 'AUTH_ERROR', 401);
      }

      // Update last_login in portal_users
      const { data: userRow, error: userError } = await supabase
        .from('portal_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', authData.user.id)
        .select()
        .single();
      if (userError || !userRow) {
        // User may not exist in portal_users yet (e.g., migrated from another system)
        throw new ServiceError('Portal user profile not found', 'NOT_FOUND', 404);
      }

      return {
        session: {
          accessToken: authData.session.access_token,
          refreshToken: authData.session.refresh_token,
          expiresAt: authData.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        },
        user: mapUserRow(userRow),
      };
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Sends a password reset email via Supabase Auth.
   * The user receives an email with a link to reset their password.
   */
  async sendPasswordReset(email: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_PORTAL_URL ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/portal`}/auth/callback`,
      });
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
