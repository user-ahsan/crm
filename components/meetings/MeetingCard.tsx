'use client';

import type { Meeting, MeetingType } from '@/types/meeting.types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatDuration } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  IconVideo,
  IconBuilding,
  IconPhone,
  IconEdit,
  IconTrash,
  IconUsers,
  IconClock,
} from '@tabler/icons-react';

interface MeetingCardProps {
  meeting: Meeting;
  onEdit?: () => void;
  onDelete?: () => void;
}

const TYPE_ICONS: Record<MeetingType, React.ReactNode> = {
  online: <IconVideo size={16} className="text-blue-500" />,
  offline: <IconBuilding size={16} className="text-green-500" />,
  call: <IconPhone size={16} className="text-amber-500" />,
  video: <IconVideo size={16} className="text-blue-500" />,
  in_person: <IconBuilding size={16} className="text-green-500" />,
  other: <IconClock size={16} className="text-gray-500" />,
};

const TYPE_BADGE_VARIANTS: Record<MeetingType, 'default' | 'secondary' | 'outline'> = {
  online: 'default',
  offline: 'secondary',
  call: 'outline',
  video: 'default',
  in_person: 'secondary',
  other: 'outline',
};

const TYPE_LABELS: Record<MeetingType, string> = {
  online: 'Online',
  offline: 'Offline',
  call: 'Call',
  video: 'Video',
  in_person: 'In Person',
  other: 'Other',
};

export function MeetingCard({ meeting, onEdit, onDelete }: MeetingCardProps) {
  const typeIcon = TYPE_ICONS[meeting.type];
  const typeBadgeVariant = TYPE_BADGE_VARIANTS[meeting.type];
  const meetingDate = new Date(meeting.dateTime);
  const isPast = meetingDate < new Date();

  return (
    <Card
      size="sm"
      className={cn(
        'transition-colors',
        isPast && 'opacity-70'
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Header row: icon, title, badge, actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="mt-0.5 flex-shrink-0">{typeIcon}</span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-medium text-foreground">
                {meeting.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Type badge */}
            <Badge
              variant={typeBadgeVariant}
              className="hidden text-[10px] capitalize sm:inline-flex"
            >
              {TYPE_LABELS[meeting.type]}
            </Badge>

            {/* Action buttons */}
            {onEdit && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onEdit}
                aria-label="Edit meeting"
              >
                <IconEdit size={14} />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onDelete}
                aria-label="Delete meeting"
                className="text-muted-foreground hover:text-destructive"
              >
                <IconTrash size={14} />
              </Button>
            )}
          </div>
        </div>

        {/* Mobile type badge */}
        <Badge
          variant={typeBadgeVariant}
          className="self-start text-[10px] capitalize sm:hidden"
        >
          {TYPE_LABELS[meeting.type]}
        </Badge>

        {/* Date, time, and duration row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatDateTime(meeting.dateTime)}</span>
          <span className="flex items-center gap-1">
            <IconClock size={12} />
            {formatDuration(meeting.duration)}
          </span>
        </div>

        {/* Participants */}
        {meeting.participants.length > 0 && (
          <div className="flex items-start gap-1.5">
            <IconUsers size={12} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
            <div className="flex flex-wrap gap-1">
              {meeting.participants.map((participant, idx) => (
                <span
                  key={idx}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {participant}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related entity link */}
        {meeting.relatedToType && (
          <div className="text-[11px] text-muted-foreground">
            <span className="capitalize">{meeting.relatedToType}</span>
            {meeting.relatedToId && (
              <span className="ml-1 font-mono text-[10px]">#{meeting.relatedToId}</span>
            )}
          </div>
        )}

        {/* Notes preview */}
        {meeting.notes && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {meeting.notes}
          </p>
        )}

        {/* Outcome */}
        {meeting.outcome && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Outcome:</span>{' '}
            <span>{meeting.outcome}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MeetingCard;
