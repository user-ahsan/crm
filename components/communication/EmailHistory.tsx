'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmailComposer } from '@/components/communication/EmailComposer';
import { IconMail, IconArrowBackUp, IconSend, IconMessage, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
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

export function EmailHistory({ emails, loading, entityType, entityId, onSend, onRefresh, subject, toAddress }: EmailHistoryProps) {
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
              return (
                <div
                  key={email.id}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    email.direction === 'inbound' ? 'bg-muted/30' : 'bg-background',
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
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-normal',
                            email.status === 'draft' && 'border-yellow-300 text-yellow-600',
                            email.status === 'failed' && 'border-red-300 text-red-600',
                            email.status === 'sent' && 'border-green-300 text-green-600',
                          )}
                        >
                          {email.status}
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
