'use client';

import {
  IconUsers,
  IconCalendar,
  IconCheckbox,
  IconCurrencyDollar,
  IconArrowRight,
  IconUserPlus,
  IconBell,
  IconX,
} from '@tabler/icons-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatRelativeTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Notification } from '@/hooks/useNotifications';

/* ── Fade-in animation ───────────────────────────────────── */
const notificationStyles = `
  @keyframes notificationFadeIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .notification-enter {
    animation: notificationFadeIn 0.3s ease-out;
  }
`;

/* ── Icon Map ─────────────────────────────────────────────── */
const notificationIcons = {
  lead_created: { icon: IconUsers, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
  meeting_scheduled: { icon: IconCalendar, color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30' },
  task_due: { icon: IconCheckbox, color: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30' },
  deal_won: { icon: IconCurrencyDollar, color: 'text-green-500 bg-green-100 dark:bg-green-900/30' },
  status_change: { icon: IconArrowRight, color: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30' },
  member_joined: { icon: IconUserPlus, color: 'text-teal-500 bg-teal-100 dark:bg-teal-900/30' },
} as const;

// Guard against malformed/foreign realtime payloads whose `type` is not one of
// the known keys — a broadcast with an unexpected type must never crash the
// panel (it is mounted inside AppShell, so a throw here blanks the whole app).
const FALLBACK_ICON = {
  icon: IconBell,
  color: 'text-muted-foreground bg-muted',
} as const;

/* ── Props ────────────────────────────────────────────────── */
export interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
}

/* ── Component ────────────────────────────────────────────── */
export function NotificationPanel({
  open,
  onOpenChange,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
}: NotificationPanelProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        {/* ── Animations ──────────────────────────────── */}
        <style>{notificationStyles}</style>

        {/* ── Header ───────────────────────────────────── */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <SheetTitle className="text-lg font-semibold">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {unreadCount} unread
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
              Mark all read
            </Button>
          )}
        </div>

        <Separator />

        {/* ── Notification List / Empty State ──────────── */}
        <ScrollArea className="flex-1">
          {notifications.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
                <IconCheckbox className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No notifications yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                We&apos;ll let you know when something new arrives.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const iconConfig = notificationIcons[notification.type] ?? FALLBACK_ICON;
                const Icon = iconConfig.icon;
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'group relative flex gap-3 px-6 py-4 transition-colors',
                      !notification.read && 'bg-muted/30',
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full',
                        iconConfig.color,
                      )}
                    >
                      <Icon className="size-4" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            'text-sm',
                            !notification.read
                              ? 'font-semibold text-foreground'
                              : 'text-foreground',
                          )}
                        >
                          {notification.title}
                        </p>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          {!notification.read && (
                            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                          )}
                          {formatRelativeTime(notification.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                        {notification.description}
                      </p>
                    </div>

                    {/* Mark as read button */}
                    {!notification.read && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(notification.id)}
                        className="absolute right-6 top-6 size-2 rounded-full bg-primary hover:opacity-80"
                        aria-label="Mark as read"
                      />
                    )}

                    {/* Dismiss button — visible to keyboard (focus-visible) and
                        touch users, not only on mouse hover */}
                    <button
                      type="button"
                      onClick={() => onDismiss(notification.id)}
                      className="absolute right-6 top-10 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 hover:text-foreground"
                      aria-label="Dismiss notification"
                    >
                      <IconX className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
