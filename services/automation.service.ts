import { createClient } from '@/lib/supabase/client';
import type { AutomationRule, AutomationRuleFormData, AutomationTriggerEvent } from '@/types/automation.types';
import type { DbAutomationRule, AutomationRuleInsert, AutomationRuleUpdate } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

let _client: Awaited<ReturnType<typeof createClient>> | null = null;
async function getClient() {
  if (!_client) _client = await createClient();
  return _client;
}

function mapRowToRule(row: DbAutomationRule): AutomationRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerEvent: row.trigger_event,
    conditions: row.conditions ?? [],
    actions: row.actions ?? [],
    enabled: row.enabled,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFormToInsert(data: AutomationRuleFormData, userId: string): AutomationRuleInsert {
  return {
    name: data.name,
    description: data.description ?? '',
    trigger_event: data.triggerEvent,
    conditions: data.conditions ?? [],
    actions: data.actions ?? [],
    enabled: data.enabled ?? true,
    created_by: userId,
  };
}

export const automationService = {
  async getAll(page = 1, pageSize = 50): Promise<AutomationRule[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToRule) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getById(id: string): Promise<AutomationRule | undefined> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return data ? mapRowToRule(data) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async create(data: AutomationRuleFormData, userId: string): Promise<AutomationRule> {
    try {
      const supabase = await getClient();
      const dbRow = mapFormToInsert(data, userId);
      const { data: inserted, error } = await supabase
        .from('automation_rules')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapRowToRule(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async update(id: string, data: Partial<AutomationRuleFormData>): Promise<AutomationRule | undefined> {
    try {
      const supabase = await getClient();
      const dbData: AutomationRuleUpdate = {};
      if (data.name !== undefined) dbData.name = data.name;
      if (data.description !== undefined) dbData.description = data.description;
      if (data.triggerEvent !== undefined) dbData.trigger_event = data.triggerEvent;
      if (data.conditions !== undefined) dbData.conditions = data.conditions;
      if (data.actions !== undefined) dbData.actions = data.actions;
      if (data.enabled !== undefined) dbData.enabled = data.enabled;
      const { data: updated, error } = await supabase
        .from('automation_rules')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      return updated ? mapRowToRule(updated) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getClient();
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async getByTrigger(event: AutomationTriggerEvent): Promise<AutomationRule[]> {
    try {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('trigger_event', event)
        .eq('enabled', true);
      if (error) throw new Error(error.message);
      return data?.map(mapRowToRule) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  evaluateRule(rule: AutomationRule, context: Record<string, unknown>): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return true;
    return rule.conditions.every((condition) => {
      const actual = context[condition.field];
      if (actual === undefined || actual === null) return false;
      const actualStr = String(actual);
      switch (condition.operator) {
        case 'equals':
          return actualStr === condition.value;
        case 'not_equals':
          return actualStr !== condition.value;
        case 'contains':
          return actualStr.toLowerCase().includes(condition.value.toLowerCase());
        case 'greater_than':
          return Number(actualStr) > Number(condition.value);
        case 'less_than':
          return Number(actualStr) < Number(condition.value);
        case 'changed':
          return true;
        default:
          return false;
      }
    });
  },

  async executeActions(actions: import('@/types/automation.types').AutomationAction[], context: Record<string, unknown>): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'assign_user':
            console.log('[Automation] Assign user:', action.config.targetUser, 'to entity:', context.id);
            break;
          case 'change_status':
            console.log('[Automation] Change status to:', action.config.status, 'for entity:', context.id);
            break;
          case 'add_tag':
            console.log('[Automation] Add tag:', action.config.tag, 'to entity:', context.id);
            break;
          case 'send_email':
            console.log('[Automation] Send email with template:', action.config.templateId, 'to:', action.config.recipient);
            break;
          case 'send_notification':
            console.log('[Automation] Send notification:', action.config.message, 'to user:', action.config.userId);
            break;
          case 'trigger_webhook':
            console.log('[Automation] Trigger webhook:', action.config.url, 'with payload:', JSON.stringify(context));
            break;
        }
      } catch (e) {
        console.error(`[Automation] Failed to execute action ${action.type}:`, e);
      }
    }
  },
};
