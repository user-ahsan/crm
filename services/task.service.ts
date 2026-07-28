import { getSharedClient } from '@/lib/supabase/client';
import type { Task, TaskFormData, TaskStatus } from '@/types/task.types';
import type { DbTask, TaskInsert } from '@/types/supabase.types';
import { asEnum, ServiceError, toServiceError } from './supabase.service';
import { activityService } from './activity.service';
import { triggerWebhook } from './webhook.service';

const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'overdue'] as const;

function mapRowToTask(row: DbTask): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    relatedToType: row.related_to_type as Task['relatedToType'] | undefined,
    relatedToId: row.related_to_id ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    dueDate: row.due_date ?? undefined,
    priority: row.priority as Task['priority'],
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

  async applyOverdue(tasks: Task[]): Promise<Task[]> {
    const supabase = await getSharedClient();
    const now = new Date();
    const updatedTasks = tasks.map((task) => {
      if (task.dueDate && task.status === 'pending') {
        const dueDate = new Date(task.dueDate);
        if (dueDate < now) {
          // Persist overdue status to DB
          supabase.from('tasks').update({ status: 'overdue' }).eq('id', task.id).then(
            ({ error }: { error: { message: string } | null }) => { if (error) console.error(`Failed to persist overdue status for task ${task.id}: ${error.message}`); }
          );
          return { ...task, status: 'overdue' as TaskStatus };
        }
      }
      return task;
    });
    return updatedTasks;
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
      }
      triggerWebhook('task.updated', { id, ...data });
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
        triggerWebhook('task.updated', { id, status: 'completed' });
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
      const ops = [
        supabase.from('activities').delete().eq('entity_id', id),
      ];
      const results = await Promise.all(ops);
      for (const r of results) if (r.error) console.error(`Cascade delete error: ${r.error.message}`);
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw toServiceError(error);
      activityService.log('task', id, 'deleted', `Task deleted`);
      triggerWebhook('task.deleted', { id });
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
