import { getSharedClient } from '@/lib/supabase/client';
import { TASK_STATUSES } from '@/lib/constants';
import type { Task, TaskFormData, TaskStatus } from '@/types/task.types';
import type { DbTask, TaskInsert } from '@/types/supabase.types';
import { asEnum, toServiceError } from './supabase.service';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';
import { automationService } from './automation.service';

/**
 * Statuses applyOverdue may flip to 'overdue'. This is the NOT-completed
 * set: a completed task must never be overwritten by the overdue write
 * (the guarded UPDATE below enforces this at the DB layer, closing the
 * fire-and-forget race — see applyOverdue). `in_progress` behaves like
 * `pending` for overdue purposes (a task in progress is not done).
 */
const OVERDUE_ELIGIBLE_STATUSES: TaskStatus[] = ['pending', 'in_progress'];

/** Returns a copy of the task with its status computed as overdue (in-memory only). */
function computeOverdue(task: Task): Task {
  return { ...task, status: 'overdue' };
}

function mapRowToTask(row: DbTask): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    relatedToType: row.related_to_type ?? undefined,
    relatedToId: row.related_to_id ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    dueDate: row.due_date ?? undefined,
    priority: row.priority,
    status: asEnum(row.status, TASK_STATUSES),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTaskToDb(task: Partial<TaskFormData & { status: TaskStatus }>): Partial<TaskInsert> {
  const db: Partial<TaskInsert> = {};
  if (task.title !== undefined) db.title = task.title;
  if (task.description !== undefined) db.description = task.description || null;
  if (task.relatedToType !== undefined) db.related_to_type = task.relatedToType || null;
  if (task.relatedToId !== undefined) db.related_to_id = task.relatedToId || null;
  if (task.assignedTo !== undefined) db.assigned_to = task.assignedTo || null;
  if (task.dueDate !== undefined) db.due_date = task.dueDate || null;
  if (task.priority !== undefined) db.priority = task.priority;
  if (task.status !== undefined) db.status = task.status;
  return db;
}

export const taskService = {
  async getAll(page = 1, pageSize = 50): Promise<Task[]> {
    return this.getAllRaw(page, pageSize);
  },

  async getAllRaw(page = 1, pageSize = 50): Promise<Task[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      const tasks = data?.map(mapRowToTask) ?? [];
      return this.applyOverdue(tasks);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Computes overdue tasks in memory and persists each transition.
   *
   * Race safety (C11): the UPDATE is guarded with
   * `.in('status', OVERDUE_ELIGIBLE_STATUSES)` and AWAITED, so an
   * in-flight flip can never overwrite a task the user completed in the
   * meantime, and the read path no longer fires-and-forgets a write.
   *
   * The `task.overdue` webhook/automation dispatch happens ONLY when the
   * guarded update actually persisted (a row came back) — never on
   * read-only paths, and at most once per transition, because the row's
   * status becomes 'overdue' and no longer matches the guard on later
   * reads.
   *
   * ponytail: a persist failure is silently skipped on the read path —
   * the in-memory result still reflects the computed overdue status and
   * the next read retries the guarded update. If overdue-persistence
   * telemetry is ever needed, add a background reconciliation job;
   * surfacing failures here would turn every list read into an error.
   */
  async applyOverdue(tasks: Task[]): Promise<Task[]> {
    if (tasks.length === 0) return tasks;
    const supabase = await getSharedClient();
    const now = new Date();
    const result = [...tasks];

    for (const task of tasks) {
      if (!task.dueDate) continue;
      if (!OVERDUE_ELIGIBLE_STATUSES.includes(task.status)) continue;
      const dueDate = new Date(task.dueDate);
      if (isNaN(dueDate.getTime()) || dueDate >= now) continue;

      const index = result.findIndex((t) => t.id === task.id);
      try {
        const { data: persistedRow, error } = await supabase
          .from('tasks')
          .update({ status: 'overdue' })
          .eq('id', task.id)
          .in('status', OVERDUE_ELIGIBLE_STATUSES)
          .select()
          .maybeSingle();
        if (error) {
          // Persist failed — the read still succeeds with the computed
          // overdue status; the next read retries the guarded update.
          if (index >= 0) result[index] = computeOverdue(task);
          continue;
        }
        if (!persistedRow) {
          // Guarded update matched nothing → the row is no longer pending
          // (e.g. completed concurrently). DB wins; do not flip in memory.
          continue;
        }
        // Transition persisted — reconcile the in-memory row and dispatch
        // once, exactly like PATTERN-webhooks.md §3b.
        if (index >= 0) result[index] = computeOverdue(task);
        triggerWebhook('task.overdue', {
          id: task.id,
          title: task.title,
          assignedTo: task.assignedTo,
          dueDate: task.dueDate,
          status: 'overdue',
        });
        await automationService.evaluate('task.overdue', {
          entityType: 'task',
          entityId: task.id,
          title: task.title,
          dueDate: task.dueDate,
          status: 'overdue',
          assignedTo: task.assignedTo,
        });
      } catch {
        // Read path must never throw — keep the computed overdue in memory.
        if (index >= 0) result[index] = computeOverdue(task);
      }
    }
    return result;
  },

  async getById(id: string): Promise<Task | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      if (!data) return undefined;
      const task = mapRowToTask(data);
      return (await this.applyOverdue([task]))[0];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getByEntity(entityType: string, entityId: string, page = 1, pageSize = 50): Promise<Task[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('related_to_type', entityType)
        .eq('related_to_id', entityId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      const tasks = data?.map(mapRowToTask) ?? [];
      return this.applyOverdue(tasks);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getByAssignedTo(userId: string, page = 1, pageSize = 50): Promise<Task[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      const tasks = data?.map(mapRowToTask) ?? [];
      return this.applyOverdue(tasks);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async create(data: TaskFormData): Promise<Task> {
    try {
      const supabase = await getSharedClient();
      const dbRow = {
        ...mapTaskToDb(data),
        status: 'pending',
      };
      const { data: inserted, error } = await supabase
        .from('tasks')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw toServiceError(error);
      const task = mapRowToTask(inserted);
      activityService.log('task', task.id, 'task_created', `Task created: ${task.title}`, {
        priority: task.priority,
      });
      triggerWebhook('task.created', {
        id: task.id,
        title: task.title,
        priority: task.priority,
        relatedToType: task.relatedToType,
        relatedToId: task.relatedToId,
      });
      await automationService.evaluate('task.created', {
        entityType: 'task',
        entityId: task.id,
        title: task.title,
        priority: task.priority,
        relatedToType: task.relatedToType,
        relatedToId: task.relatedToId,
      });
      return task;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async update(id: string, data: Partial<TaskFormData & { status: TaskStatus }>): Promise<Task | undefined> {
    try {
      const supabase = await getSharedClient();
      const dbData = { ...mapTaskToDb(data) };
      const { data: updated, error } = await supabase
        .from('tasks')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      const task = mapRowToTask(updated);
      if (data.status === 'completed') {
        activityService.log('task', id, 'task_completed', `Task completed: ${task.title}`);
        triggerWebhook('task.completed', {
          id: task.id,
          title: task.title,
          assignedTo: task.assignedTo,
          status: 'completed',
        });
        await automationService.evaluate('task.completed', {
          entityType: 'task',
          entityId: task.id,
          title: task.title,
          status: 'completed',
          assignedTo: task.assignedTo,
        });
      } else {
        triggerWebhook('task.updated', { id, ...data });
        await automationService.evaluate('task.updated', {
          entityType: 'task',
          entityId: id,
          ...data,
        });
      }
      return task;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async toggleStatus(id: string): Promise<Task | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data: completedData, error: completedErr } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', id)
        .not('status', 'eq', 'completed')
        .select()
        .maybeSingle();
      if (completedErr) throw toServiceError(completedErr);
      if (completedData) {
        const task = mapRowToTask(completedData);
        activityService.log('task', id, 'task_completed', `Task completed: ${task.title}`);
        triggerWebhook('task.completed', {
          id: task.id,
          title: task.title,
          assignedTo: task.assignedTo,
          status: 'completed',
        });
        await automationService.evaluate('task.completed', {
          entityType: 'task',
          entityId: task.id,
          title: task.title,
          status: 'completed',
          assignedTo: task.assignedTo,
        });
        return task;
      }
      const { data: pendingData, error: pendingErr } = await supabase
        .from('tasks')
        .update({ status: 'pending' })
        .eq('id', id)
        .eq('status', 'completed')
        .select()
        .maybeSingle();
      if (pendingErr) throw toServiceError(pendingErr);
      if (pendingData) {
        const task = mapRowToTask(pendingData);
        activityService.log('task', id, 'updated', `Task reopened: ${task.title}`);
        triggerWebhook('task.updated', { id, status: 'pending' });
        await automationService.evaluate('task.updated', {
          entityType: 'task',
          entityId: task.id,
          title: task.title,
          status: 'pending',
        });
        return task;
      }
      return undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      // Cascades scoped by related-entity type so deleting a task can never
      // remove another entity's records (C16). Tables whose CHECK
      // constraints exclude 'task' (email_history, call_logs, sms_logs,
      // portal_shares) cannot reference a task and need no cascade here.
      const cascades = [
        supabase.from('activities').delete().eq('entity_type', 'task').eq('entity_id', id),
        supabase.from('taggings').delete().eq('taggable_type', 'task').eq('taggable_id', id),
        supabase.from('file_attachments').delete().eq('related_to_type', 'task').eq('related_to_id', id),
        supabase.from('notes').delete().eq('related_to_type', 'task').eq('related_to_id', id),
        supabase.from('meetings').delete().eq('related_to_type', 'task').eq('related_to_id', id),
      ];
      const results = await Promise.all(cascades);
      for (const result of results) {
        if (result.error) throw toServiceError(result.error);
      }
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw toServiceError(error);
      activityService.log('task', id, 'deleted', `Task deleted`);
      triggerWebhook('task.deleted', { id });
      await automationService.evaluate('task.deleted', { entityType: 'task', entityId: id });
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
