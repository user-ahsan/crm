import { getSharedClient } from '@/lib/supabase/client';
import type { AutomationRule, AutomationRuleFormData, AutomationTriggerEvent, AutomationAction } from '@/types/automation.types';
import type { DbAutomationRule, AutomationRuleInsert, AutomationRuleUpdate } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';
import { tagService } from './tag.service';
import { communicationService } from './communication.service';
import { activityService } from './activity.service';
import { sendWebhookToUrl } from './webhook.service';
import { sendNotification } from './realtime.service';

const ENTITY_TABLE_MAP: Record<string, string> = {
  lead: 'leads',
  contact: 'contacts',
  company: 'companies',
  task: 'tasks',
  meeting: 'meetings',
  deal: 'deals',
};

/**
 * Email templates referenced by the `send_email` action's `templateId`
 * config key (collected by CreateRuleDialog). The dialog has no free-form
 * subject/body fields, so a rule must either reference a known template
 * here or the executor falls back to `action.config.subject`/`body` when
 * a rule was authored programmatically.
 */
const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  'template-1': {
    subject: 'Update from NexusCRM',
    body: 'Hello,\n\nThis is an automated update from your NexusCRM account.\n\nBest regards,\nThe NexusCRM Team',
  },
  'template-follow-up': {
    subject: 'Follow-up from NexusCRM',
    body: 'Hello,\n\nWe wanted to follow up regarding your recent activity.\n\nBest regards,\nThe NexusCRM Team',
  },
  'template-welcome': {
    subject: 'Welcome to NexusCRM',
    body: 'Hello,\n\nWelcome to NexusCRM. We are glad to have you on board.\n\nBest regards,\nThe NexusCRM Team',
  },
};

/** Per-rule/per-action failure detail from an evaluation run. */
export interface AutomationEvaluationFailure {
  ruleId: string;
  ruleName: string;
  actionType: string;
  error: string;
}

/** Typed result of `automationService.evaluate(...)` — never throws. */
export interface AutomationEvaluationResult {
  event: string;
  matched: number;
  executed: number;
  failures: AutomationEvaluationFailure[];
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
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      return data?.map(mapRowToRule) ?? [];
    } catch (e) {
      throw toServiceError(e);
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
        throw toServiceError(error);
      }
      return data ? mapRowToRule(data) : undefined;
    } catch (e) {
      throw toServiceError(e);
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
      if (error) throw toServiceError(error);
      return mapRowToRule(inserted);
    } catch (e) {
      throw toServiceError(e);
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
        throw toServiceError(error);
      }
      return updated ? mapRowToRule(updated) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
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
      if (error) throw toServiceError(error);
      return data?.map(mapRowToRule) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Canonical automation entry point. Entity services call this AFTER a
   * mutation, next to their `triggerWebhook(...)` call:
   *
   *   await automationService.evaluate('lead.status_changed', {
   *     entityType: 'lead',
   *     entityId: lead.id,
   *     fullName: lead.fullName,
   *     status: lead.status,
   *     previousStatus,
   *   });
   *
   * Contract: NEVER throws. The rule fetch, per-rule evaluation, and each
   * action are isolated — failures are collected into the typed result so
   * the mutation path is never broken by an automation failure.
   *
   * `event` is any emitted webhook event name; rules are stored against the
   * `AutomationTriggerEvent` subset, so unknown events simply match zero
   * rules.
   */
  async evaluate(
    event: string,
    context: Record<string, unknown>,
  ): Promise<AutomationEvaluationResult> {
    const failures: AutomationEvaluationFailure[] = [];
    let matched = 0;
    let executed = 0;

    try {
      const rules = await this.getByTrigger(event as AutomationTriggerEvent);
      // Expose the event name to actions (e.g. trigger_webhook payloads).
      const ruleContext = { ...context, eventName: event };

      for (const rule of rules) {
        try {
          if (!this.evaluateRule(rule, ruleContext)) continue;
          matched += 1;
          const outcome = await this.executeActions(rule.actions, ruleContext);
          executed += outcome.results.filter((r) => r.success).length;
          for (const result of outcome.results) {
            if (!result.success) {
              failures.push({
                ruleId: rule.id,
                ruleName: rule.name,
                actionType: result.action,
                error: result.error ?? 'Action failed',
              });
            }
          }
        } catch (error) {
          failures.push({
            ruleId: rule.id,
            ruleName: rule.name,
            actionType: 'rule',
            error: error instanceof Error ? error.message : 'Rule evaluation failed',
          });
        }
      }
    } catch (error) {
      failures.push({
        ruleId: 'engine',
        ruleName: 'evaluate',
        actionType: 'engine',
        error: error instanceof Error ? error.message : 'Automation evaluation failed',
      });
    }

    return { event, matched, executed, failures };
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
        case 'greater_than': {
          const numVal = Number(condition.value);
          const numActual = Number(actualStr);
          // Guard against NaN from Number() comparisons
          if (isNaN(numVal) || isNaN(numActual)) return false;
          return numActual > numVal;
        }
        case 'less_than': {
          const numVal = Number(condition.value);
          const numActual = Number(actualStr);
          if (isNaN(numVal) || isNaN(numActual)) return false;
          return numActual < numVal;
        }
        case 'changed': {
          // 'changed' matches when the event context carries BOTH the current
          // value and its previous-value sibling and they differ. The sibling
          // key follows the PATTERN-webhooks §5 convention: status →
          // previousStatus, stageId → previousStageId (previous + capitalized
          // field name). A blank condition.value means "changed to anything";
          // a value restricts to "changed to exactly this value".
          const prevKey = `previous${condition.field.charAt(0).toUpperCase()}${condition.field.slice(1)}`;
          const previous = context[prevKey];
          if (previous === undefined || previous === actual) return false;
          return condition.value.trim() === '' || actualStr === condition.value;
        }
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

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'assign_user': {
            const table = ENTITY_TABLE_MAP[entityType];
            if (!table) throw new ServiceError(`Unknown entity type: ${entityType}`, 'INVALID_ENTITY_TYPE');
            const supabase = await getSharedClient();
            const { error } = await supabase
              .from(table)
              .update({ assigned_to: action.config.targetUser })
              .eq('id', entityId);
            if (error) throw toServiceError(error);
            activityService.log(entityType, entityId, 'assigned', `Assigned to user ${action.config.targetUser}`);
            results.push({ action: action.type, success: true });
            break;
          }

          case 'change_status': {
            const table = ENTITY_TABLE_MAP[entityType];
            if (!table) throw new ServiceError(`Unknown entity type: ${entityType}`, 'INVALID_ENTITY_TYPE');
            const supabase = await getSharedClient();
            const { error } = await supabase
              .from(table)
              .update({ status: action.config.status })
              .eq('id', entityId);
            if (error) throw toServiceError(error);
            results.push({ action: action.type, success: true });
            break;
          }

          case 'add_tag': {
            // If tag is a name, find tag ID first, else use as ID
            const tagName = action.config.tag;
            if (tagName) {
              const allTags = await tagService.getAll();
              const matchedTag = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
              if (matchedTag) {
                await tagService.addTagToEntity(entityType, entityId, matchedTag.id);
              } else {
                // Create tag by name then use ID
                const newTag = await tagService.create(tagName);
                await tagService.addTagToEntity(entityType, entityId, newTag.id);
              }
            }
            results.push({ action: action.type, success: true });
            break;
          }

          case 'send_email': {
            // The rule dialog collects recipient + templateId; resolve the
            // template to a real subject/body, falling back to programmatic
            // config keys with documented defaults.
            const recipient = action.config.recipient;
            if (!recipient) {
              results.push({ action: action.type, success: false, error: 'send_email requires action.config.recipient' });
              break;
            }
            const template = action.config.templateId ? EMAIL_TEMPLATES[action.config.templateId] : undefined;
            const subject = template?.subject ?? action.config.subject ?? 'Automated message';
            const body = template?.body ?? action.config.body ?? '';
            if (!body.trim()) {
              results.push({ action: action.type, success: false, error: 'send_email requires a body — set action.config.body or a known templateId' });
              break;
            }
            // sendEmail validates subject/body and, when no email provider is
            // configured, persists the record as 'queued' with an honest
            // error message instead of failing (simulated send).
            await communicationService.sendEmail({
              toAddress: recipient,
              subject,
              body,
              relatedToType: entityType,
              relatedToId: entityId,
            });
            results.push({ action: action.type, success: true });
            break;
          }

          case 'send_notification': {
            // Create a REAL notification for the target user: broadcast push
            // (instant, when the user's client has a channel open) plus a
            // persistent activity row scoped to the triggering entity (the
            // catch-up source for offline users). There is no dedicated
            // notifications table yet; when one lands, replace the activity
            // row with a typed insert.
            const userId = action.config.userId;
            const message = action.config.message || 'You have a new notification from NexusCRM';
            if (!userId) {
              results.push({ action: action.type, success: false, error: 'send_notification requires action.config.userId' });
              break;
            }
            try {
              await sendNotification(userId, {
                id: `automation-${crypto.randomUUID()}`,
                type: 'status_change',
                title: 'Automation Notification',
                description: message,
                timestamp: new Date().toISOString(),
                read: false,
                data: {
                  entityType,
                  entityId,
                  eventName: typeof context.eventName === 'string' ? context.eventName : undefined,
                },
              });
              await activityService.log(
                entityType,
                entityId,
                'updated',
                `Automation notification sent to ${userId}: ${message}`,
                { automationAction: action.type, targetUserId: userId, eventName: context.eventName },
              );
              results.push({ action: action.type, success: true });
            } catch (notificationError) {
              results.push({
                action: action.type,
                success: false,
                error: notificationError instanceof Error ? notificationError.message : 'Failed to send notification',
              });
            }
            break;
          }

          case 'trigger_webhook': {
            // POST directly to the URL captured in the rule config. The
            // shared sender applies the SSRF guard + 10s abort timeout.
            const url = action.config.url;
            if (!url) {
              results.push({ action: action.type, success: false, error: 'trigger_webhook requires action.config.url' });
              break;
            }
            const sent = await sendWebhookToUrl(url, null, {
              event: typeof context.eventName === 'string' ? context.eventName : `automation.${action.type}`,
              timestamp: new Date().toISOString(),
              data: { ...context },
              metadata: { automationAction: action.type },
            });
            results.push({
              action: action.type,
              success: sent.success,
              error: sent.error ?? (sent.success ? undefined : 'Webhook delivery failed'),
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
