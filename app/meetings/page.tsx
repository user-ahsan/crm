'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { MeetingCalendar } from '@/components/meetings/MeetingCalendar';
import { MeetingCreateForm } from '@/components/meetings/MeetingCreateForm';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useMeetings } from '@/hooks/useMeetings';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { IconPlus, IconCalendarEvent } from '@tabler/icons-react';
import type { Meeting } from '@/types/meeting.types';
import { ExportDropdown } from '@/components/common/ExportDropdown';
import { ImportDialog } from '@/components/common/ImportDialog';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { useCsvExport } from '@/hooks/useCsvExport';

export default function MeetingsPage() {
  const { meetings, loading, error, refresh } = useMeetings();
  const [createOpen, setCreateOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { exportEntity, isExporting } = useCsvExport();

  const handleCreateSuccess = useCallback(
    (meeting: Meeting) => {
      toast.success(`Meeting "${meeting.title}" scheduled`);
      refresh();
      setCreateOpen(false);
    },
    [refresh]
  );

  const handleCreateCancel = useCallback(() => {
    setCreateOpen(false);
  }, []);

  // Loading state — initial data fetch
  if (loading && meetings.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
            <div className="mt-1 h-4 w-56 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-9 w-40 animate-pulse rounded-lg bg-muted" />
        </div>
        <LoadingSkeleton type="card" count={2} />
      </div>
    );
  }

  // Error state
  if (error && meetings.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Meetings" />
        <ErrorState
          title="Failed to load meetings"
          message={error}
          onRetry={refresh}
        />
      </div>
    );
  }

  // Empty state
  if (!loading && meetings.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Meetings">
          <div className="flex items-center gap-2">
            <ExportDropdown
              entityTypes={[{ key: 'meetings', label: 'Meetings' }]}
              onExport={exportEntity}
              isExporting={isExporting}
            />
            <PermissionGuard action="create" entity="meeting">
              <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                Import
              </Button>
            </PermissionGuard>
            <PermissionGuard action="create" entity="meeting">
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <IconPlus size={16} />
                Schedule Meeting
              </Button>
            </PermissionGuard>
          </div>
        </PageHeader>
        <EmptyState
          icon={<IconCalendarEvent size={48} stroke={1.5} />}
          title="No meetings scheduled"
          description="Schedule your first meeting to coordinate with your team and clients"
          action={{
            label: 'Schedule Meeting',
            onClick: () => setCreateOpen(true),
          }}
        />
        <MeetingCreateForm
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
        title="Meetings"
        description={
          loading
            ? undefined
            : `${meetings.length} meeting${meetings.length !== 1 ? 's' : ''} scheduled`
        }
      >
        <div className="flex items-center gap-2">
          <ExportDropdown
            entityTypes={[{ key: 'meetings', label: 'Meetings' }]}
            onExport={exportEntity}
            isExporting={isExporting}
          />
          <PermissionGuard action="create" entity="meeting">
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              Import
            </Button>
          </PermissionGuard>
          <PermissionGuard action="create" entity="meeting">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} />
              Schedule Meeting
            </Button>
          </PermissionGuard>
        </div>
      </PageHeader>

      {/* Meeting calendar — month/week view */}
      <MeetingCalendar />

      {/* Create meeting dialog */}
      <MeetingCreateForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleCreateSuccess}
      />
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        entityType="meetings"
        entityLabel="Meetings"
        onImportComplete={refresh}
      />
    </div>
  );
}
