'use client';

import { useState, useCallback } from 'react';
import {
  IconUsers,
  IconCalendar,
  IconCheckbox,
  IconCurrencyDollar,
  IconArrowRight,
  IconX,
} from '@tabler/icons-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatRelativeTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

/* ── Types ────────────────────────────────────────────────── */
interface Notification {
  id: string;
  type: 'lead_created' | 'meeting_scheduled' | 'task_due' | 'deal_won' | 'status_change';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

/* ── Props ────────────────────────────────────────────────── */
export interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ── Icon Map ─────────────────────────────────────────────── */
const notificationIcons = {
  lead_created: { icon: IconUsers, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
  meeting_scheduled: { icon: IconCalendar, color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30' },
  task_due: { icon: IconCheckbox, color: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30' },
  deal_won: { icon: IconCurrencyDollar, color: 'text-green-500 bg-green-100 dark:bg-green-900/30' },
  status_change: { icon: IconArrowRight, color: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30' },
} as const;

/* ── Mock Notifications ───────────────────────────────────── */
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    type: 'lead_created',
    title: 'New lead created',
    description: 'Sarah Johnson from Acme Corp has been added as a new lead.',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    read: false,
  },
  {
    id: 'notif-2',
    type: 'meeting_scheduled',
    title: 'Meeting scheduled',
    description: 'Product demo with David Brown at 3:00 PM tomorrow.',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    read: false,
  },
  {
    id: 'notif-3',
    type: 'task_due',
    title: 'Task due soon',
    description: '"Follow up with TechStar Inc" is due in 2 hours.',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    read: true,
  },
  {
    id: 'notif-4',
    type: 'deal_won',
    title: 'Deal won!',
    description: 'Enterprise contract with Globex Corp closed at $50,000.',
    timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
    read: false,
  },
  {
    id: 'notif-5',
    type: 'status_change',
    title: 'Lead stage updated',
    description: 'Alice Wonder moved from "New" to "Qualified" in the pipeline.',
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
    read: true,
  },
  {
    id: 'notif-6',
    type: 'lead_created',
    title: 'New lead created',
    description: 'Mark Thompson from InnoVentures has been added as a new lead.',
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
    read: true,
  },
];

/* ── Component ────────────────────────────────────────────── */
export function NotificationPanel({ open, onOpenChange }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
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
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
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
                const iconConfig = notificationIcons[notification.type];
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
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(notification.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                        {notification.description}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {!notification.read && (
                      <span className="absolute right-6 top-6 size-2 rounded-full bg-primary" />
                    )}

                    {/* Dismiss */}
                    <button
                      type="button"
                      onClick={() => handleDismiss(notification.id)}
                      className="absolute right-6 top-6 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                      aria-label="Dismiss notification"
                    >
                      <IconX className="size-3.5 text-muted-foreground" />
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
