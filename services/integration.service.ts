import { getSharedClient } from '@/lib/supabase/client';
import type { CalendarIntegration, CalendarIntegrationFormData, CalendarProvider } from '@/types/integration.types';
import type { DbCalendarIntegration, CalendarIntegrationInsert } from '@/types/supabase.types';
import { toServiceError } from './supabase.service';

function mapRow(row: DbCalendarIntegration): CalendarIntegration {
  return {
    id: row.id,
    provider: row.provider as CalendarProvider,
    email: row.email,
    syncEnabled: row.sync_enabled,
    lastSyncedAt: row.last_synced_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export const integrationService = {
  async getCalendarIntegrations(): Promise<CalendarIntegration[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('calendar_integrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw toServiceError(error);
      return data?.map(mapRow) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Creates a new calendar integration record after OAuth completion.
   * For Google, the tokens are already saved via `storeTokens()` in the
   * callback route — this method looks up the existing record and returns it.
   */
  async connectCalendar(data: CalendarIntegrationFormData): Promise<CalendarIntegration> {
    try {
      const supabase = await getSharedClient();
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData?.user?.id ?? 'system';

      // For Google OAuth, the record may already exist from the callback
      if (data.provider === 'google') {
        const { data: existing } = await supabase
          .from('calendar_integrations')
          .select('*')
          .eq('created_by', createdBy)
          .eq('provider', 'google')
          .maybeSingle();

        if (existing) return mapRow(existing);
      }

      // Fallback: create a minimal record (used by non-OAuth providers or mock)
      const { data: inserted, error } = await supabase
        .from('calendar_integrations')
        .insert({
          provider: data.provider,
          email: data.email,
          sync_enabled: true,
          created_by: createdBy,
        })
        .select()
        .single();

      if (error) throw toServiceError(error);
      return mapRow(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Saves a full OAuth integration record with encrypted tokens.
   * Called by the OAuth callback route after exchanging the auth code.
   * This is the primary method for creating OAuth-based integrations.
   */
  async saveOAuthIntegration(data: CalendarIntegrationInsert): Promise<CalendarIntegration> {
    try {
      const supabase = await getSharedClient();
      const { data: inserted, error } = await supabase
        .from('calendar_integrations')
        .insert(data as never)
        .select()
        .single();

      if (error) throw toServiceError(error);
      return mapRow(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Updates the last_synced_at timestamp for an integration.
   */
  async updateLastSynced(integrationId: string): Promise<void> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase
        .from('calendar_integrations')
        .update({ last_synced_at: new Date().toISOString() } as never)
        .eq('id', integrationId);

      if (error) throw toServiceError(error);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async disconnect(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.from('calendar_integrations').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async toggleSync(id: string, enabled: boolean): Promise<CalendarIntegration | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data: updated, error } = await supabase
        .from('calendar_integrations')
        .update({ sync_enabled: enabled })
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return updated ? mapRow(updated) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
