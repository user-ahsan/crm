'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SmsComposer } from '@/components/communication/SmsComposer';
import { IconDeviceMobileMessage, IconArrowBackUp, IconSend, IconMessage, IconChevronDown, IconChevronUp, IconCopy, IconCheck } from '@tabler/icons-react';
import type { SmsLog } from '@/types/sms.types';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface SmsSendData {
  toNumber: string;
  body: string;
  relatedToType?: string;
  relatedToId?: string;
}

interface SmsHistoryProps {
  smsLogs: SmsLog[];
  loading: boolean;
  entityType?: string;
  entityId?: string;
  onSend: (data: SmsSendData) => Promise<void>;
  onRefresh?: () => void;
  toNumber?: string;
}

export function SmsHistory({ smsLogs, loading, entityType, entityId, onSend, onRefresh, toNumber }: SmsHistoryProps) {
  const [showComposer, setShowComposer] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleSend = async (data: { toNumber: string; body: string }) => {
    await onSend({
      ...data,
      relatedToType: entityType,
      relatedToId: entityId,
    });
    setShowComposer(false);
    onRefresh?.();
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'sent':
        return 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400';
      case 'delivered':
        return 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400';
      case 'failed':
        return 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="inline-flex items-center gap-2 text-base">
          <IconDeviceMobileMessage className="size-4" />
          SMS
          {!loading && smsLogs.length > 0 && (
            <span className="rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
              {smsLogs.length}
            </span>
          )}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setShowComposer(!showComposer)}>
          <IconMessage className="size-4" />
          Compose
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showComposer && (
          <SmsComposer
            toNumber={toNumber || ''}
            relatedToType={entityType}
            relatedToId={entityId}
            onSend={handleSend}
            onClose={() => setShowComposer(false)}
          />
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : smsLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <IconDeviceMobileMessage className="mb-2 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No SMS messages yet.</p>
            {!showComposer && (
              <Button variant="link" size="sm" onClick={() => setShowComposer(true)} className="mt-1">
                Send your first SMS
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {smsLogs.map((sms) => {
              const isExpanded = expandedId === sms.id;
              return (
                <div
                  key={sms.id}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    sms.direction === 'inbound' ? 'bg-muted/30' : 'bg-background',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        {sms.direction === 'inbound' ? (
                          <IconArrowBackUp className="size-3.5 shrink-0 text-blue-500" />
                        ) : (
                          <IconSend className="size-3.5 shrink-0 text-green-500" />
                        )}
                        <span className="font-medium text-foreground truncate">
                          {sms.direction === 'inbound' ? sms.fromNumber : sms.toNumber}
                        </span>
                        <Badge variant="outline" className={cn('text-[10px] font-normal', statusBadgeClass(sms.status))}>
                          {sms.status}
                        </Badge>
                      </div>
                      <p className={cn('mt-1 text-sm text-muted-foreground', !isExpanded && 'line-clamp-2')}>
                        {sms.body}
                      </p>

                      {/* Expanded details: provider ID and error */}
                      {isExpanded && (sms.providerMessageId || sms.errorMessage) && (
                        <div className="mt-2 space-y-1.5 border-t pt-2 text-xs">
                          {sms.providerMessageId && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="font-medium">Provider ID:</span>
                              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                                {sms.providerMessageId}
                              </code>
                              <button
                                onClick={() => copyToClipboard(sms.providerMessageId!, sms.id)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {copiedId === sms.id ? (
                                  <IconCheck className="size-3 text-green-500" />
                                ) : (
                                  <IconCopy className="size-3" />
                                )}
                              </button>
                            </div>
                          )}
                          {sms.errorMessage && (
                            <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                              <span className="font-medium shrink-0">Error:</span>
                              <span>{sms.errorMessage}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(sms.createdAt)}
                      </span>
                      <Button variant="ghost" size="icon-xs" onClick={() => toggleExpand(sms.id)}>
                        {isExpanded ? <IconChevronUp className="size-3.5" /> : <IconChevronDown className="size-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
