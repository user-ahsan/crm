'use client';

import {
  IconMenu2,
  IconSearch,
  IconSun,
  IconMoon,
  IconBell,
  IconUser,
  IconSettings,
  IconLogout,
  IconChevronDown,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { USERS } from '@/lib/constants';
import { useThemeStore } from '@/store/theme';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ── Props ───────────────────────────────────────────────── */
export interface TopBarProps {
  /** Opens/closes the mobile sidebar */
  onMenuToggle: () => void;
  /** Opens the command palette (Cmd+K) */
  onSearchClick: () => void;
  /** Opens the notification panel */
  onNotificationClick: () => void;
  /** Number of unread notifications */
  notificationCount?: number;
}

/* ── Component ───────────────────────────────────────────── */
export function TopBar({ onMenuToggle, onSearchClick, onNotificationClick, notificationCount = 3 }: TopBarProps) {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const currentUser = USERS[0] ?? { initials: '?', name: 'User' };

  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4',
      )}
    >
      {/* ── Left: Mobile Menu Toggle ─────────────────────── */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuToggle}
        className="md:hidden"
        aria-label="Open sidebar menu"
      >
        <IconMenu2 className="size-5" />
      </Button>

      {/* Spacer to keep layout balanced when menu button is hidden */}
      <div className="hidden md:block md:w-9" aria-hidden="true" />

      {/* ── Center / Search ──────────────────────────────── */}
      <button
        type="button"
        onClick={onSearchClick}
        className={cn(
          'flex flex-1 max-w-md items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2',
          'text-sm text-muted-foreground transition-colors',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'md:max-w-sm lg:max-w-md',
        )}
        aria-label="Open search"
      >
        <IconSearch className="size-4 shrink-0" aria-hidden="true" />

        <span className="hidden flex-1 text-left sm:inline">
          Search anything...
        </span>
        <span className="sm:hidden">Search</span>

        <kbd
          className={cn(
            'ml-auto hidden shrink-0 items-center gap-0.5 rounded-md border bg-background px-1.5',
            'py-0.5 text-[10px] font-medium text-muted-foreground',
            'sm:inline-flex',
          )}
        >
          <span>⌘</span>
          <span>K</span>
        </kbd>
      </button>

      {/* ── Right: Actions ───────────────────────────────── */}
      <div className="flex items-center gap-1">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <IconSun className="size-5" />
          ) : (
            <IconMoon className="size-5" />
          )}
        </Button>

        {/* Notification Bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
          onClick={onNotificationClick}
        >
          <IconBell className="size-5" />
          {notificationCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 flex size-4 min-w-0 items-center justify-center rounded-full p-0 text-[10px] leading-none"
            >
              {notificationCount > 99 ? '99+' : notificationCount}
            </Badge>
          )}
        </Button>

        {/* User Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="gap-2 pl-2 pr-2">
                <Avatar size="sm">
                  <AvatarFallback className="text-xs">
                    {currentUser.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[100px] truncate text-sm font-medium md:inline">
                  {currentUser.name}
                </span>
                <IconChevronDown className="hidden size-3.5 text-muted-foreground md:block" />
              </Button>
            }
          />

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    <AvatarFallback className="text-xs">
                      {currentUser.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {currentUser.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      admin@nexuscrm.io
                    </p>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem>
                <IconUser className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconSettings className="size-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive">
              <IconLogout className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
