import { getSharedClient } from '@/lib/supabase/client';
import type { CalendarIntegration, CalendarIntegrationFormData, CalendarProvider } from '@/types/integration.types';
import type { DbCalendarIntegration } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';

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

  async connectCalendar(data: CalendarIntegrationFormData): Promise<CalendarIntegration> {
    try {
      const supabase = await getSharedClient();
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData?.user?.id ?? 'system';

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
