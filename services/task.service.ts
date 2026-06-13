import { createClient } from '@/lib/supabase/client';
import type { Task, TaskFormData, TaskStatus } from '@/types/task.types';
import type { DbTask } from '@/types/supabase.types';
import { formatSupabaseError, addLocalActivity } from './supabase.service';

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
    status: row.status as Task['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTaskToDb(task: Partial<TaskFormData & { status: TaskStatus }>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
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
  async getAll(): Promise<Task[]> {
    const all = await this.getAllRaw();
    return [...all];
  },

  /** Internal: get all tasks and update overdue status */
  async getAllRaw(): Promise<Task[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      const tasks = (data as DbTask[] | null)?.map(mapRowToTask) ?? [];
      return this.applyOverdue(tasks);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to fetch tasks');
    }
  },

  /** Apply overdue status to a list of tasks in memory */
  applyOverdue(tasks: Task[]): Task[] {
    const now = new Date();
    return tasks.map((task) => {
      if (task.dueDate && task.status === 'pending') {
        const dueDate = new Date(task.dueDate);
        if (dueDate < now) {
          return { ...task, status: 'overdue' as TaskStatus };
        }
      }
      return task;
    });
  },

  async getById(id: string): Promise<Task | undefined> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      if (!data) return undefined;
      const task = mapRowToTask(data as DbTask);
      const overdue = this.applyOverdue([task]);
      return overdue[0];
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch task ${id}`);
    }
  },

  async getByEntity(entityType: string, entityId: string): Promise<Task[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('related_to_type', entityType)
        .eq('related_to_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      const tasks = (data as DbTask[] | null)?.map(mapRowToTask) ?? [];
      return this.applyOverdue(tasks);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch tasks for ${entityType}/${entityId}`);
    }
  },

  async getByAssignedTo(userId: string): Promise<Task[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', userId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      const tasks = (data as DbTask[] | null)?.map(mapRowToTask) ?? [];
      return this.applyOverdue(tasks);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to fetch tasks for user ${userId}`);
    }
  },

  async create(data: TaskFormData): Promise<Task> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();
      const dbRow = {
        ...mapTaskToDb(data),
        status: 'pending',
        created_at: now,
        updated_at: now,
      };
      const { data: inserted, error } = await supabase
        .from('tasks')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const task = mapRowToTask(inserted as DbTask);
      addLocalActivity('task', task.id, 'task_created', `Task created: ${task.title}`, {
        priority: task.priority,
      });
      return task;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to create task');
    }
  },

  async update(id: string, data: Partial<TaskFormData & { status: TaskStatus }>): Promise<Task | undefined> {
    const now = new Date().toISOString();
    try {
      const supabase = await createClient();
      const dbData = { ...mapTaskToDb(data), updated_at: now };
      const { data: updated, error } = await supabase
        .from('tasks')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(error.message);
      }
      const task = mapRowToTask(updated as DbTask);
      if (data.status === 'completed') {
        addLocalActivity('task', id, 'task_completed', `Task completed: ${task.title}`);
      }
      return task;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to update task ${id}`);
    }
  },

  async toggleStatus(id: string): Promise<Task | undefined> {
    try {
      const task = await this.getById(id);
      if (!task) return undefined;
      const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
      return this.update(id, { status: newStatus });
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to toggle task status ${id}`);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : `Failed to delete task ${id}`);
    }
  },
};
