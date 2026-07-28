'use client';

import { useState, useMemo, useCallback } from 'react';
import { useMeetings } from '@/hooks/useMeetings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { formatDate, formatDateTime, formatDuration } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  IconChevronLeft,
  IconChevronRight,
  IconCalendar,
  IconList,
  IconRefresh,
  IconAlertTriangle,
  IconCalendarEvent,
  IconVideo,
  IconBuilding,
  IconPhone,
} from '@tabler/icons-react';
import type { Meeting, MeetingType } from '@/types/meeting.types';

type ViewMode = 'month' | 'week';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  online: <IconVideo size={14} />,
  offline: <IconBuilding size={14} />,
  call: <IconPhone size={14} />,
  video: <IconVideo size={14} />,
  in_person: <IconBuilding size={14} />,
  other: <IconCalendar size={14} />,
};

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date, today: Date): boolean {
  return isSameDay(date, today);
}

function isCurrentMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  // Pad with leading days from previous month (Monday start)
  const startDayOfWeek = firstDay.getDay();
  const mondayOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  for (let i = mondayOffset; i > 0; i--) {
    days.push(new Date(year, month, 1 - i));
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // Pad trailing days to complete last row
  const remaining = days.length % 7;
  const trailingCount = remaining === 0 ? 0 : 7 - remaining;
  for (let i = 1; i <= trailingCount; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(d);
    dayDate.setDate(d.getDate() + i);
    days.push(dayDate);
  }
  return days;
}

function getMeetingsForDay(meetings: Meeting[], day: Date): Meeting[] {
  return meetings.filter((m) => {
    const mDate = new Date(m.dateTime);
    return isSameDay(mDate, day);
  });
}

function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getWeekRangeLabel(days: Date[]): string {
  if (days.length === 0) return '';
  const start = days[0];
  const end = days[6];
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

export function MeetingCalendar() {
  const { meetings, loading, error, refresh } = useMeetings();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [today] = useState(() => new Date());

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const calendarDays = useMemo(
    () => getDaysInMonth(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const meeting of meetings) {
      const key = new Date(meeting.dateTime).toDateString();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(meeting);
    }
    return map;
  }, [meetings]);

  const selectedDayMeetings = useMemo(() => {
    if (!selectedDate) return [];
    return getMeetingsForDay(meetings, selectedDate);
  }, [meetings, selectedDate]);

  const handlePrevMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handlePrevWeek = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const handleNextWeek = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const handleDayClick = useCallback((day: Date) => {
    setSelectedDate(day);
    setSheetOpen(true);
  }, []);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
          <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
            <IconAlertTriangle size={20} className="text-destructive" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Failed to load meetings</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <IconRefresh size={14} />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('month')}
            aria-label="Month view"
          >
            <IconCalendar size={16} />
            <span className="ml-1 hidden sm:inline">Month</span>
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('week')}
            aria-label="Week view"
          >
            <IconList size={16} />
            <span className="ml-1 hidden sm:inline">Week</span>
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={handleToday}>
          <IconCalendarEvent size={14} />
          <span className="ml-1">Today</span>
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={viewMode === 'month' ? handlePrevMonth : handlePrevWeek}
            aria-label={viewMode === 'month' ? 'Previous month' : 'Previous week'}
          >
            <IconChevronLeft size={18} />
          </Button>
          <h2 className="min-w-[200px] text-center text-base font-semibold">
            {viewMode === 'month'
              ? formatMonthYear(currentYear, currentMonth)
              : getWeekRangeLabel(weekDays)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={viewMode === 'month' ? handleNextMonth : handleNextWeek}
            aria-label={viewMode === 'month' ? 'Next month' : 'Next week'}
          >
            <IconChevronRight size={18} />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh meetings"
        >
          <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <CalendarSkeleton viewMode={viewMode} />
      ) : (
        <>
          {viewMode === 'month' ? (
            <MonthView
              days={calendarDays}
              currentYear={currentYear}
              currentMonth={currentMonth}
              meetingsByDay={meetingsByDay}
              onDayClick={handleDayClick}
              today={today}
            />
          ) : (
            <WeekView
              days={weekDays}
              meetingsByDay={meetingsByDay}
              onDayClick={handleDayClick}
              today={today}
            />
          )}

          {/* Empty state */}
          {meetings.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <IconCalendarEvent size={20} className="text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">No meetings scheduled</p>
                <p className="mt-0.5 text-xs text-muted-foreground/60">
                  Create a meeting to get started
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Day details sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {selectedDate ? formatDate(selectedDate.toISOString()) : 'Select a day'}
            </SheetTitle>
            <SheetDescription>
              {selectedDayMeetings.length > 0
                ? `${selectedDayMeetings.length} meeting${selectedDayMeetings.length !== 1 ? 's' : ''} scheduled`
                : 'No meetings scheduled for this day'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3 px-6 pb-6">
            {selectedDayMeetings.length > 0 ? (
              selectedDayMeetings.map((meeting) => (
                <DayMeetingItem key={meeting.id} meeting={meeting} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <IconCalendarEvent size={20} className="text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No meetings</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MonthView({
  days,
  currentYear,
  currentMonth,
  meetingsByDay,
  onDayClick,
  today,
}: {
  days: Date[];
  currentYear: number;
  currentMonth: number;
  meetingsByDay: Map<string, Meeting[]>;
  onDayClick: (day: Date) => void;
  today: Date;
}) {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {DAY_HEADERS.map((header) => (
            <div
              key={header}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {header}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {weeks.map((week, weekIdx) => (
          <div
            key={week[0].toISOString()}
            className={cn(
              'grid grid-cols-7',
              weekIdx < weeks.length - 1 && 'border-b'
            )}
          >
            {week.map((day, dayIdx) => {
              const dateKey = day.toDateString();
              const dayMeetings = meetingsByDay.get(dateKey);
              const meetingCount = dayMeetings?.length ?? 0;
              const inMonth = isCurrentMonth(day, currentYear, currentMonth);
              const isDayToday = isToday(day, today);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => onDayClick(day)}
                  className={cn(
                    'relative flex min-h-[80px] flex-col items-center gap-0.5 border-r p-1.5 text-sm transition-colors hover:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    dayIdx % 7 === 6 && 'border-r-0',
                    !inMonth && 'text-muted-foreground/40'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full text-xs',
                      isDayToday &&
                        'bg-primary text-primary-foreground font-semibold'
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {/* Meeting indicators */}
                  {meetingCount > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5">
                      {meetingCount <= 3 ? (
                        dayMeetings!.slice(0, 3).map((m) => {
                          const typeColor =
                            m.type === 'online'
                              ? 'bg-blue-500'
                              : m.type === 'offline'
                                ? 'bg-green-500'
                                : 'bg-amber-500';
                          return (
                            <span
                              key={m.id}
                              className={cn('size-1.5 rounded-full', typeColor)}
                              title={m.title}
                            />
                          );
                        })
                      ) : (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          +{meetingCount}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WeekView({
  days,
  meetingsByDay,
  onDayClick,
  today,
}: {
  days: Date[];
  meetingsByDay: Map<string, Meeting[]>;
  onDayClick: (day: Date) => void;
  today: Date;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {/* Day headers with date */}
        <div className="grid grid-cols-7 border-b">
          {days.map((day, idx) => {
            const isDayToday = isToday(day, today);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'flex flex-col items-center py-2',
                  idx < 6 && 'border-r'
                )}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {DAY_HEADERS[idx]}
                </span>
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-sm',
                    isDayToday && 'bg-primary text-primary-foreground font-semibold'
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Meeting slots per day */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dateKey = day.toDateString();
            const dayMeetings = meetingsByDay.get(dateKey) ?? [];

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'flex min-h-[200px] flex-col gap-1 p-1.5',
                  idx < 6 && 'border-r'
                )}
              >
                {dayMeetings.length > 0 ? (
                  dayMeetings.slice(0, 4).map((meeting) => (
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={() => onDayClick(day)}
                      className={cn(
                        'flex flex-col gap-0.5 rounded-lg border p-1.5 text-left text-xs transition-colors hover:bg-muted/50',
                        meeting.type === 'online' && 'border-blue-200 dark:border-blue-800',
                        meeting.type === 'offline' && 'border-green-200 dark:border-green-800',
                        meeting.type === 'call' && 'border-amber-200 dark:border-amber-800'
                      )}
                    >
                      <span className="truncate font-medium">{meeting.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDateTime(meeting.dateTime)}
                      </span>
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => onDayClick(day)}
                    className="flex h-full min-h-[40px] cursor-pointer items-center justify-center rounded-lg border border-dashed border-transparent text-[10px] text-muted-foreground/30 hover:border-muted-foreground/20 hover:text-muted-foreground/50"
                  >
                    +
                  </button>
                )}

                {dayMeetings.length > 4 && (
                  <button
                    type="button"
                    onClick={() => onDayClick(day)}
                    className="text-[10px] font-medium text-primary hover:underline"
                  >
                    +{dayMeetings.length - 4} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DayMeetingItem({ meeting }: { meeting: Meeting }) {
  const typeIcon = TYPE_ICONS[meeting.type];

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{typeIcon}</span>
          <span className="text-sm font-medium">{meeting.title}</span>
        </div>
        <Badge variant="outline" className="text-[10px] capitalize">
          {meeting.type}
        </Badge>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{formatDateTime(meeting.dateTime)}</span>
        <span>{formatDuration(meeting.duration)}</span>
      </div>

      {meeting.participants.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {meeting.participants.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {meeting.relatedToType && (
        <span className="text-[10px] capitalize text-muted-foreground">
          Related: {meeting.relatedToType}
          {meeting.relatedToId && ` (${meeting.relatedToId})`}
        </span>
      )}
    </div>
  );
}

function CalendarSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'month') {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b pb-2">
            {DAY_HEADERS.map((h) => (
              <Skeleton key={h} className="mx-auto h-3 w-8" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, w) => (
            <div key={w} className="grid grid-cols-7 border-b py-1">
              {Array.from({ length: 7 }).map((_, d) => (
                <div key={d} className="flex flex-col items-center gap-1 p-1.5">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="h-1.5 w-4 rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b pb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="size-7 rounded-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 p-1.5">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default MeetingCalendar;
