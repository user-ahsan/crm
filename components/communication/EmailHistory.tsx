'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmailComposer } from '@/components/communication/EmailComposer';
import { IconMail, IconArrowBackUp, IconSend, IconMessage, IconChevronDown, IconChevronUp, IconCopy, IconExternalLink } from '@tabler/icons-react';
import type { Email } from '@/types/communication.types';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export interface EmailSendData {
  toAddress: string;
  subject: string;
  body: string;
  relatedToType?: string;
  relatedToId?: string;
}

interface EmailHistoryProps {
  emails: Email[];
  loading: boolean;
  entityType?: string;
  entityId?: string;
  onSend: (data: EmailSendData) => Promise<void>;
  onRefresh?: () => void;
  subject?: string;
  toAddress?: string;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied to clipboard'),
    () => toast.error('Failed to copy'),
  );
}

function statusConfig(status: Email['status']) {
  switch (status) {
    case 'sent':
      return { label: 'Sent', className: 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400' };
    case 'draft':
      return { label: 'Draft', className: 'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400' };
    case 'pending':
      return { label: 'Pending', className: 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400' };
    case 'failed':
      return { label: 'Failed', className: 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400' };
  }
}

export function EmailHistory({ emails, loading, entityType, entityId, onSend, onRefresh, toAddress }: EmailHistoryProps) {
  const [showComposer, setShowComposer] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleSend = async (data: { toAddress: string; subject: string; body: string }) => {
    await onSend({
      ...data,
      relatedToType: entityType,
      relatedToId: entityId,
    });
    setShowComposer(false);
    onRefresh?.();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="inline-flex items-center gap-2 text-base">
          <IconMail className="size-4" />
          Emails
          {!loading && emails.length > 0 && (
            <span className="rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
              {emails.length}
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
          <EmailComposer
            toAddress={toAddress || ''}
            relatedToType={entityType}
            relatedToId={entityId}
            onSend={handleSend}
            onClose={() => setShowComposer(false)}
          />
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <IconMail className="mb-2 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No emails yet.</p>
            {!showComposer && (
              <Button variant="link" size="sm" onClick={() => setShowComposer(true)} className="mt-1">
                Send your first email
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {emails.map((email) => {
              const isExpanded = expandedId === email.id;
              const statusCfg = statusConfig(email.status);
              const hasProviderId = !!email.providerMessageId;
              const hasError = !!email.errorMessage;
              return (
                <div
                  key={email.id}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    email.direction === 'inbound' ? 'bg-muted/30' : 'bg-background',
                    email.status === 'failed' && 'border-red-200 dark:border-red-900/50',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        {email.direction === 'inbound' ? (
                          <IconArrowBackUp className="size-3.5 shrink-0 text-blue-500" />
                        ) : (
                          <IconSend className="size-3.5 shrink-0 text-green-500" />
                        )}
                        <span className="font-medium text-foreground truncate">
                          {email.direction === 'inbound' ? email.fromAddress : email.toAddress}
                        </span>
                        <Badge variant="outline" className={cn('text-[10px] font-normal', statusCfg.className)}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                      {email.subject && (
                        <p className="mt-0.5 text-sm font-medium text-foreground truncate">
                          {email.subject}
                        </p>
                      )}
                      <p className={cn('mt-1 text-sm text-muted-foreground', !isExpanded && 'line-clamp-2')}>
                        {email.body}
                      </p>

                      {isExpanded && (
                        <div className="mt-3 space-y-2 border-t pt-2">
                          {hasProviderId && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium">Provider ID:</span>
                              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                                {email.providerMessageId}
                              </code>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(email.providerMessageId!)}
                                className="text-muted-foreground hover:text-foreground"
                                title="Copy provider message ID"
                              >
                                <IconCopy className="size-3" />
                              </button>
                              <a
                                href={`https://resend.com/emails/${email.providerMessageId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                              >
                                <IconExternalLink className="size-3" />
                                View in Resend
                              </a>
                            </div>
                          )}
                          {hasError && (
                            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                              <span className="shrink-0 font-medium">Error:</span>
                              <span>{email.errorMessage}</span>
                            </div>
                          )}
                          {!hasProviderId && !hasError && email.status === 'sent' && (
                            <p className="text-xs text-muted-foreground">Sent via Resend</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(email.createdAt)}
                      </span>
                      <Button variant="ghost" size="icon-xs" onClick={() => toggleExpand(email.id)}>
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
