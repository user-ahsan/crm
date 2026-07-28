import { getSharedClient } from '@/lib/supabase/client';
import type { WorkflowState, WorkflowTransition, WorkflowStateFormData, WorkflowTransitionFormData, WorkflowEntityType } from '@/types/workflow.types';
import type { DbWorkflowState, DbWorkflowTransition } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';

function mapState(row: DbWorkflowState): WorkflowState {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    entityType: row.entity_type,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapTransition(row: DbWorkflowTransition): WorkflowTransition {
  return {
    id: row.id,
    fromStateId: row.from_state_id,
    toStateId: row.to_state_id,
    label: row.label,
    createdAt: row.created_at,
  };
}

export const workflowService = {
  async getStates(entityType: WorkflowEntityType): Promise<WorkflowState[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('workflow_states')
        .select('*')
        .eq('entity_type', entityType)
        .order('sort_order', { ascending: true });
      if (error) throw toServiceError(error);
      return data?.map(mapState) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async createState(data: WorkflowStateFormData & { createdBy: string }): Promise<WorkflowState> {
    try {
      const supabase = await getSharedClient();
      const maxResult = await supabase
        .from('workflow_states')
        .select('sort_order')
        .eq('entity_type', data.entityType)
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextOrder = (maxResult.data?.[0]?.sort_order ?? -1) + 1;

      const { data: row, error } = await supabase
        .from('workflow_states')
        .insert({
          name: data.name,
          color: data.color,
          entity_type: data.entityType,
          sort_order: nextOrder,
          created_by: data.createdBy,
        })
        .select()
        .single();
      if (error) throw toServiceError(error);
      return mapState(row);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async updateState(id: string, updates: { name?: string; color?: string }): Promise<WorkflowState | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('workflow_states')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data ? mapState(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async deleteState(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      // Also delete transitions referencing this state
      const { error: transErr } = await supabase
        .from('workflow_transitions')
        .delete()
        .or(`from_state_id.eq.${id},to_state_id.eq.${id}`);
      if (transErr) throw toServiceError(transErr);
      const { error } = await supabase.from('workflow_states').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async reorderStates(ids: string[]): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      // Validate that IDs exist before upsert
      const { data: existing, error: fetchErr } = await supabase
        .from('workflow_states')
        .select('id')
        .in('id', ids);
      if (fetchErr) throw toServiceError(fetchErr);

      if (!existing || existing.length !== ids.length) {
        const found = new Set(existing?.map((e: { id: string }) => e.id) ?? []);
        const missing = ids.filter(id => !found.has(id));
        throw new ServiceError(`Cannot reorder: states not found: ${missing.join(', ')}`, 'STATES_NOT_FOUND');
      }

      const updates = ids.map((id, index) => ({ id, sort_order: index }));
      const { error } = await supabase.from('workflow_states').upsert(updates);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getTransitions(): Promise<WorkflowTransition[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('workflow_transitions')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw toServiceError(error);
      return data?.map(mapTransition) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async createTransition(data: WorkflowTransitionFormData): Promise<WorkflowTransition> {
    try {
      const supabase = await getSharedClient();
      const { data: row, error } = await supabase
        .from('workflow_transitions')
        .insert({
          from_state_id: data.fromStateId,
          to_state_id: data.toStateId,
          label: data.label ?? '',
        })
        .select()
        .single();
      if (error) throw toServiceError(error);
      return mapTransition(row);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async deleteTransition(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.from('workflow_transitions').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
