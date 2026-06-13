'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskCreateForm } from '@/components/tasks/TaskCreateForm';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useTasks } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { IconPlus, IconChecklist } from '@tabler/icons-react';
import { ExportDropdown } from '@/components/common/ExportDropdown';
import { ImportDialog } from '@/components/common/ImportDialog';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { useCsvExport } from '@/hooks/useCsvExport';

export default function TasksPage() {
  const { tasks, loading, error, refresh } = useTasks();
  const [createOpen, setCreateOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { exportEntity, isExporting } = useCsvExport();

  const handleCreateSuccess = useCallback(() => {
    refresh();
    setCreateOpen(false);
  }, [refresh]);

  const handleCreateCancel = useCallback(() => {
    setCreateOpen(false);
  }, []);

  // Loading state — initial data fetch
  if (loading && tasks.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
            <div className="mt-1 h-4 w-48 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
        </div>
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  // Error state
  if (error && tasks.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Tasks" />
        <ErrorState
          title="Failed to load tasks"
          message={error}
          onRetry={refresh}
        />
      </div>
    );
  }

  // Empty state
  if (!loading && tasks.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Tasks">
          <div className="flex items-center gap-2">
            <ExportDropdown
              entityTypes={[{ key: 'tasks', label: 'Tasks' }]}
              onExport={exportEntity}
              isExporting={isExporting}
            />
            <PermissionGuard action="create" entity="task">
              <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                Import
              </Button>
            </PermissionGuard>
            <PermissionGuard action="create" entity="task">
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <IconPlus size={16} />
                New Task
              </Button>
            </PermissionGuard>
          </div>
        </PageHeader>
        <EmptyState
          icon={<IconChecklist size={48} stroke={1.5} />}
          title="No tasks yet"
          description="Create your first task to start tracking work items and staying organised"
          action={{
            label: 'Create Task',
            onClick: () => setCreateOpen(true),
          }}
        />
        <TaskCreateForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={handleCreateSuccess}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Tasks"
        description={
          loading
            ? undefined
            : `${tasks.filter((t) => t.status === 'pending').length} pending · ${tasks.filter((t) => t.status === 'completed').length} completed`
        }
      >
        <div className="flex items-center gap-2">
          <ExportDropdown
            entityTypes={[{ key: 'tasks', label: 'Tasks' }]}
            onExport={exportEntity}
            isExporting={isExporting}
          />
          <PermissionGuard action="create" entity="task">
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              Import
            </Button>
          </PermissionGuard>
          <PermissionGuard action="create" entity="task">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} />
              New Task
            </Button>
          </PermissionGuard>
        </div>
      </PageHeader>

      {/* Task list with filter tabs */}
      <TaskList />

      {/* Create task dialog */}
      <TaskCreateForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleCreateSuccess}
      />
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        entityType="tasks"
        entityLabel="Tasks"
        onImportComplete={refresh}
      />
    </div>
  );
}
