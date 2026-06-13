import { getSharedClient } from '@/lib/supabase/client';
import type { SavedView, SavedViewFormData, ViewEntityType } from '@/types/saved-view.types';
import type { DbSavedView, SavedViewUpdate } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

function mapRow(row: DbSavedView): SavedView {
  return {
    id: row.id,
    name: row.name,
    entityType: row.entity_type as ViewEntityType,
    filters: row.filters,
    sortBy: row.sort_by,
    sortOrder: (row.sort_order as 'asc' | 'desc') ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const savedViewService = {
  async getViews(entityType: ViewEntityType): Promise<SavedView[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('saved_views')
        .select('*')
        .eq('entity_type', entityType)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return data?.map(mapRow) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async create(data: SavedViewFormData): Promise<SavedView> {
    try {
      const supabase = await getSharedClient();
      const dbRow = {
        name: data.name,
        entity_type: data.entityType,
        filters: data.filters,
        sort_by: data.sortBy ?? null,
        sort_order: data.sortOrder ?? null,
        created_by: 'system',
      };
      const { data: inserted, error } = await supabase
        .from('saved_views')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapRow(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async update(id: string, data: Partial<SavedViewFormData>): Promise<SavedView | undefined> {
    try {
      const supabase = await getSharedClient();
      const dbData: Partial<SavedViewUpdate> = {};
      if (data.name !== undefined) dbData.name = data.name;
      if (data.filters !== undefined) dbData.filters = data.filters;
      if (data.sortBy !== undefined) dbData.sort_by = data.sortBy;
      if (data.sortOrder !== undefined) dbData.sort_order = data.sortOrder;
      const { data: updated, error } = await supabase
        .from('saved_views')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return updated ? mapRow(updated) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.from('saved_views').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
