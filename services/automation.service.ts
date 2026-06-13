import { getSharedClient } from '@/lib/supabase/client';
import type { AutomationRule, AutomationRuleFormData, AutomationTriggerEvent, AutomationAction } from '@/types/automation.types';
import type { DbAutomationRule, AutomationRuleInsert, AutomationRuleUpdate } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';
import { tagService } from './tag.service';
import { communicationService } from './communication.service';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';

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
      const supabase = await getSharedClient();
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
      const supabase = await getSharedClient();
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
      const supabase = await getSharedClient();
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
      const supabase = await getSharedClient();
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
      const supabase = await getSharedClient();
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
      const supabase = await getSharedClient();
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

  async executeActions(
    actions: AutomationAction[],
    context: Record<string, unknown>,
  ): Promise<{ success: boolean; results: { action: string; success: boolean; error?: string }[] }> {
    const entityType = context.entityType as string;
    const entityId = context.entityId as string;
    const results: { action: string; success: boolean; error?: string }[] = [];

    const entityTableMap: Record<string, string> = {
      lead: 'leads',
      contact: 'contacts',
      company: 'companies',
      task: 'tasks',
      meeting: 'meetings',
      deal: 'deals',
    };

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'assign_user': {
            const table = entityTableMap[entityType];
            if (!table) {
              results.push({ action: action.type, success: false, error: `Unknown entity type: ${entityType}` });
              break;
            }
            const supabase = await getSharedClient();
            const { error } = await supabase
              .from(table)
              .update({ assigned_to: action.config.targetUser })
              .eq('id', entityId);
            if (error) throw new Error(error.message);
            activityService.log(entityType, entityId, 'assigned', `Assigned to user ${action.config.targetUser}`);
            results.push({ action: action.type, success: true });
            break;
          }

          case 'change_status': {
            const table = entityTableMap[entityType];
            if (!table) {
              results.push({ action: action.type, success: false, error: `Unknown entity type: ${entityType}` });
              break;
            }
            const supabase = await getSharedClient();
            const { error } = await supabase
              .from(table)
              .update({ status: action.config.status })
              .eq('id', entityId);
            if (error) throw new Error(error.message);
            results.push({ action: action.type, success: true });
            break;
          }

          case 'add_tag': {
            await tagService.addTagToEntity(entityType, entityId, action.config.tag);
            results.push({ action: action.type, success: true });
            break;
          }

          case 'send_email': {
            await communicationService.sendEmail({
              toAddress: action.config.recipient,
              subject: `Automated message: ${action.config.templateId}`,
              body: '',
              relatedToType: entityType,
              relatedToId: entityId,
            });
            results.push({ action: action.type, success: true });
            break;
          }

          case 'send_notification': {
            await activityService.log(
              entityType,
              entityId,
              'created',
              `Automation notification: ${action.config.message || 'No message provided'}`,
              { automationAction: action.type, ...action.config },
            );
            results.push({ action: action.type, success: true });
            break;
          }

          case 'trigger_webhook': {
            const sent = await triggerWebhook(`automation.${action.type}`, {
              ...context,
              webhookUrl: action.config.url,
            });
            results.push({
              action: action.type,
              success: sent,
              error: sent ? undefined : 'Webhook delivery failed or webhooks are not configured',
            });
            break;
          }

          default: {
            results.push({ action: action.type, success: false, error: `Unknown action type: ${action.type}` });
            break;
          }
        }
      } catch (error) {
        results.push({
          action: action.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: results.every((r) => r.success),
      results,
    };
  },
};
