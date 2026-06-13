'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconLayoutDashboard,
  IconUsers,
  IconAddressBook,
  IconBuilding,
  IconColumns3,
  IconCheckbox,
  IconCalendar,
  IconChartBar,
  IconSettings,
  IconUsersGroup,
  IconChevronLeft,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/constants';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useTeamContext } from '@/context/TeamContext';
import { RoleBadge } from '@/components/teams/RoleBadge';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/* ── Icon Map ────────────────────────────────────────────── */
const iconMap = {
  'layout-dashboard': IconLayoutDashboard,
  users: IconUsers,
  'address-book': IconAddressBook,
  building: IconBuilding,
  'columns-3': IconColumns3,
  checkbox: IconCheckbox,
  calendar: IconCalendar,
  'chart-bar': IconChartBar,
  settings: IconSettings,
  'users-group': IconUsersGroup,
} as const;

type IconKey = keyof typeof iconMap;

/* ── Props ───────────────────────────────────────────────── */
export interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Called when a navigation link is clicked — used by AppShell to close mobile sheet */
  onNavClick?: () => void;
}

/* ── Component ───────────────────────────────────────────── */
export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onNavClick,
}: SidebarProps) {
  const pathname = usePathname();

  /* Determine if a nav link is the active route */
  const isActiveRoute = useCallback(
    (href: string): boolean => {
      const effectivePath = pathname === '/' ? '/dashboard' : pathname;
      return effectivePath === href || effectivePath.startsWith(`${href}/`);
    },
    [pathname],
  );

  const currentUser = useCurrentUser();
  const { role } = useTeamContext();

  /* ── Render ──────────────────────────────────────────── */
  return (
    <nav
      className={cn(
        'flex h-full flex-col bg-sidebar text-sidebar-foreground',
        'border-r border-sidebar-border transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
      aria-label="Main navigation"
    >
      {/* ── Logo ──────────────────────────────────────── */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        {collapsed ? (
          <span className="text-lg font-bold tracking-tight text-sidebar-primary">
            N
          </span>
        ) : (
          <span className="text-lg font-bold tracking-tight text-sidebar-primary">
            Nexus<span className="text-sidebar-foreground">CRM</span>
          </span>
        )}
      </div>

      <Separator />

      {/* ── Navigation Items ──────────────────────────── */}
      <div
        className={cn(
          'flex-1 overflow-y-auto',
          collapsed ? 'flex flex-col items-center gap-0.5 px-1 py-1.5' : 'space-y-0.5 px-2 py-2',
        )}
      >

        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon as IconKey];
          const isActive = isActiveRoute(item.href);

          const linkElement = (
            <Link
              href={item.href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          /* Collapsed state — show tooltip on hover */
          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      onClick={onNavClick}
                      className={cn(
                        'flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    />
                  }
                >
                  {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.href}>{linkElement}</div>;
        })}
      </div>

      <Separator />

      {/* ── User Area ─────────────────────────────────── */}
      <div className={cn('p-3', collapsed && 'p-2')}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-lg py-2 transition-colors hover:bg-sidebar-accent/50"
                    aria-label={currentUser.user?.fullName ?? 'User'}
                  />
                }
              >
                <Avatar size="sm">
                  {currentUser.user?.avatarUrl ? (
                    <AvatarImage src={currentUser.user.avatarUrl} alt={currentUser.user.fullName} />
                  ) : (
                    <AvatarFallback className="text-xs">
                      {currentUser.user?.initials ?? '?'}
                    </AvatarFallback>
                  )}
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {currentUser.user?.fullName ?? 'Loading…'}
              </TooltipContent>
            </Tooltip>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                aria-label="Expand sidebar"
              >
                <IconChevronLeft className="size-3.5 rotate-180" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              {currentUser.user?.avatarUrl ? (
                <AvatarImage src={currentUser.user.avatarUrl} alt={currentUser.user.fullName} />
              ) : (
                <AvatarFallback className="text-xs">
                  {currentUser.user?.initials ?? '?'}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {currentUser.user?.fullName ?? 'Loading…'}
              </p>
              <div className="mt-0.5">
                {role ? (
                  <RoleBadge role={role} size="sm" />
                ) : (
                  <p className="truncate text-xs text-muted-foreground">No team</p>
                )}
              </div>
            </div>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                aria-label={
                  collapsed ? 'Expand sidebar' : 'Collapse sidebar'
                }
              >
                <IconChevronLeft
                  className={cn(
                    'size-3.5 transition-transform',
                    collapsed && 'rotate-180',
                  )}
                />
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
