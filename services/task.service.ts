import { tasks as mockTasks } from '@/data/tasks';
import type { Task, TaskFormData, TaskStatus } from '@/types/task.types';
import type { DbTask } from '@/types/supabase.types';
import { generateId } from '@/lib/formatters';
import { isSupabaseConfigured, getSupabaseClient as getSupabaseClientAsync, formatSupabaseError, addLocalActivity } from './supabase.service';

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
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      const tasks = (data as DbTask[] | null)?.map(mapRowToTask) ?? [];
      return this.applyOverdue(tasks);
    }
    this.updateOverdueStatus();
    return [...mockTasks];
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
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(formatSupabaseError(error));
      }
      if (!data) return undefined;
      const task = mapRowToTask(data as DbTask);
      const overdue = this.applyOverdue([task]);
      return overdue[0];
    }
    this.updateOverdueStatus();
    return mockTasks.find((t) => t.id === id);
  },

  async getByEntity(entityType: string, entityId: string): Promise<Task[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('related_to_type', entityType)
        .eq('related_to_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      const tasks = (data as DbTask[] | null)?.map(mapRowToTask) ?? [];
      return this.applyOverdue(tasks);
    }
    this.updateOverdueStatus();
    return mockTasks.filter((t) => t.relatedToType === entityType && t.relatedToId === entityId);
  },

  async getByAssignedTo(userId: string): Promise<Task[]> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', userId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(formatSupabaseError(error));
      const tasks = (data as DbTask[] | null)?.map(mapRowToTask) ?? [];
      return this.applyOverdue(tasks);
    }
    this.updateOverdueStatus();
    return mockTasks.filter((t) => t.assignedTo === userId);
  },

  async create(data: TaskFormData): Promise<Task> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const dbRow = {
        ...mapTaskToDb(data),
        id: crypto.randomUUID(),
        status: 'pending',
        created_at: now,
        updated_at: now,
      };
      const { data: inserted, error } = await supabase
        .from('tasks')
        .insert(dbRow)
        .select()
        .single();
      if (error) throw new Error(formatSupabaseError(error));
      const task = mapRowToTask(inserted as DbTask);
      addLocalActivity('task', task.id, 'task_created', `Task created: ${task.title}`, {
        priority: task.priority,
      });
      return task;
    }
    const newTask: Task = {
      ...data,
      id: `task-${generateId().slice(0, 8)}`,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    mockTasks.unshift(newTask);
    addLocalActivity('task', newTask.id, 'task_created', `Task created: ${newTask.title}`, {
      priority: newTask.priority,
    });
    return newTask;
  },

  async update(id: string, data: Partial<TaskFormData & { status: TaskStatus }>): Promise<Task | undefined> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const dbData = { ...mapTaskToDb(data), updated_at: now };
      const { data: updated, error } = await supabase
        .from('tasks')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw new Error(formatSupabaseError(error));
      }
      const task = mapRowToTask(updated as DbTask);
      if (data.status === 'completed') {
        addLocalActivity('task', id, 'task_completed', `Task completed: ${task.title}`);
      }
      return task;
    }
    const index = mockTasks.findIndex((t) => t.id === id);
    if (index === -1) return undefined;
    const oldStatus = mockTasks[index].status;
    const updated = {
      ...mockTasks[index],
      ...data,
      updatedAt: now,
    };
    mockTasks[index] = updated;

    if (data.status && data.status !== oldStatus && data.status === 'completed') {
      addLocalActivity('task', id, 'task_completed', `Task completed: ${updated.title}`);
    }
    return updated;
  },

  async toggleStatus(id: string): Promise<Task | undefined> {
    if (isSupabaseConfigured()) {
      const task = await this.getById(id);
      if (!task) return undefined;
      const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
      return this.update(id, { status: newStatus });
    }
    const task = mockTasks.find((t) => t.id === id);
    if (!task) return undefined;
    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    return this.update(id, { status: newStatus });
  },

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClientAsync();
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw new Error(formatSupabaseError(error));
      return true;
    }
    const index = mockTasks.findIndex((t) => t.id === id);
    if (index === -1) return false;
    mockTasks.splice(index, 1);
    return true;
  },

  /** Mutates mock tasks in-place to set overdue status */
  updateOverdueStatus(): void {
    const now = new Date();
    for (const task of mockTasks) {
      if (task.dueDate && task.status === 'pending') {
        const dueDate = new Date(task.dueDate);
        if (dueDate < now) {
          task.status = 'overdue';
        }
      }
    }
  },
};
