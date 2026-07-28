'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { IconPhone, IconPhoneIncoming, IconPhoneOutgoing, IconPhoneCall } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime, formatDuration } from '@/lib/formatters';

function formatSeconds(seconds: number): string {
  return formatDuration(Math.round(seconds / 60) || 1);
}
import { CallLogDialog } from './CallLogDialog';
import type { CallLog, CallLogFormData } from '@/types/communication.types';

interface CallLogListProps {
  callLogs: CallLog[];
  loading: boolean;
  entityType?: string;
  entityId?: string;
  onLogCall: (data: CallLogFormData) => Promise<CallLog | undefined>;
}

type CallResultKey = 'completed' | 'no_answer' | 'busy' | 'failed' | 'voicemail';

const RESULT_COLORS: Record<CallResultKey, string> = {
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  no_answer: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  busy: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  voicemail: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
};

export function CallLogList({ callLogs, loading, entityType, entityId, onLogCall }: CallLogListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleSubmit(data: CallLogFormData) {
    await onLogCall({
      ...data,
      relatedToType: entityType,
      relatedToId: entityId,
    });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {callLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <IconPhone className="mb-3 size-10 text-muted-foreground" />
          <h4 className="mb-1 text-sm font-medium text-foreground">No calls logged</h4>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            No phone calls have been logged for this entity yet.
          </p>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <IconPhoneCall className="size-4" />
            Log a Call
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{callLogs.length} call{callLogs.length !== 1 ? 's' : ''}</p>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <IconPhoneCall className="size-4" />
              Log Call
            </Button>
          </div>
          <div className="space-y-2">
            {callLogs.map((call) => (
              <div
                key={call.id}
                className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div
                  className={cn(
                    'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
                    call.direction === 'inbound'
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                      : 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400',
                  )}
                >
                  {call.direction === 'inbound' ? (
                    <IconPhoneIncoming className="size-4" />
                  ) : (
                    <IconPhoneOutgoing className="size-4" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {call.caller}
                    </span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="text-sm font-medium text-foreground">
                      {call.callee}
                    </span>
                    <Badge
                      className={cn(
                        'ml-auto text-[10px] font-normal',
                        RESULT_COLORS[call.callResult] ?? 'bg-gray-100 text-gray-700',
                      )}
                    >
                      {call.callResult === 'no_answer' ? 'No Answer' : call.callResult.charAt(0).toUpperCase() + call.callResult.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="tabular-nums">{formatSeconds(call.duration)}</span>
                    <span>{formatRelativeTime(call.createdAt)}</span>
                    {call.direction === 'outbound' && <span>Outbound</span>}
                  </div>
                  {call.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{call.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <CallLogDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
