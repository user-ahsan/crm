import { createClient } from '@/lib/supabase/client';
import type { CalendarIntegration, CalendarIntegrationFormData, CalendarProvider } from '@/types/integration.types';
import type { DbCalendarIntegration } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

let _client: Awaited<ReturnType<typeof createClient>> | null = null;
async function getClient() {
  if (!_client) _client = await createClient();
  return _client;
}

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
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('calendar_integrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data?.map(mapRow) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async connectCalendar(data: CalendarIntegrationFormData): Promise<CalendarIntegration> {
    try {
      const supabase = await getClient();
      const dbRow = {
        provider: data.provider,
        email: data.email,
        access_token: 'mock_' + crypto.randomUUID(),
        sync_enabled: true,
        created_by: 'system',
      };
      const { data: inserted, error } = await supabase
        .from('calendar_integrations')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapRow(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async disconnect(id: string): Promise<boolean> {
    try {
      const supabase = await getClient();
      const { error } = await supabase.from('calendar_integrations').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async toggleSync(id: string, enabled: boolean): Promise<boolean> {
    try {
      const supabase = await getClient();
      const { error } = await supabase
        .from('calendar_integrations')
        .update({ sync_enabled: enabled })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
