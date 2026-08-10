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
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/theme';
import { useShallow } from 'zustand/shallow';
import { useCallback } from 'react';
import { useTeamContext } from '@/context/TeamContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  /** Whether the search command palette is currently open */
  isSearchOpen?: boolean;
}

/* ── Component ───────────────────────────────────────────── */
export function TopBar({ onMenuToggle, onSearchClick, onNotificationClick, notificationCount = 0, isSearchOpen }: TopBarProps) {
  const { theme, toggleTheme } = useThemeStore(useShallow(s => ({ theme: s.theme, toggleTheme: s.toggleTheme })));
  const isDark = theme === 'dark';
  const currentUser = useCurrentUser();
  const { team } = useTeamContext();
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    try {
      // 1. Sign out from Supabase (this properly clears @supabase/ssr cookies)
      const { getSupabaseClient } = await import('@/lib/supabase/client');
      await getSupabaseClient().auth.signOut();
    } catch (err) {
      console.error('Sign-out error:', err);
      toast.error('Sign-out failed');
      // Fall through — still clear local state below
    }

    // 2. Clear the shared auth user cache
    const { clearCachedUser } = await import('@/lib/cached-user');
    clearCachedUser();

    // 3. Reset Zustand auth store so all components see the signed-out state
    useAuthStore.getState().signOut();

    // 3. Clear ALL sb-* cookies (catches any naming variations from @supabase/ssr)
    const cookies = document.cookie.split('; ');
    for (const cookie of cookies) {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
      if (name.startsWith('sb-')) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
        document.cookie = `${name}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      }
    }

    // 4. Clear Supabase-related localStorage items, but PRESERVE user
    // preferences (nexuscrm-theme, nexuscrm-settings) across sign-out.
    // The auth store (sessionStorage `nexuscrm-auth`) was reset by signOut()
    // above, so the session is fully cleared without wiping prefs.
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // 5. Full-page navigation to login (ensures clean state vs router.push)
    window.location.href = '/login';
  }, []);

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
        aria-haspopup="dialog"
        aria-expanded={isSearchOpen}
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

      {/* ── Team Name Indicator ──────────────────────────── */}
      {team && (
        <div className="hidden shrink-0 items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1 sm:flex">
          <span className="text-xs font-medium text-muted-foreground">
            [{team.name}]
          </span>
        </div>
      )}

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
              <span className="sr-only">
                {notificationCount} unread notification{notificationCount !== 1 ? 's' : ''}
              </span>
              <span aria-hidden="true">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            </Badge>
          )}
        </Button>

        {/* User Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="gap-2 pl-2 pr-2">
                <Avatar size="sm">
                  {currentUser.user?.avatarUrl ? (
                    <AvatarImage src={currentUser.user.avatarUrl} alt={currentUser.user.fullName} />
                  ) : (
                    <AvatarFallback className="text-xs">
                      {currentUser.user?.initials ?? '?'}
                    </AvatarFallback>
                  )}
                </Avatar>
                  <span className="hidden max-w-[100px] truncate text-sm font-medium md:inline">
                    {currentUser.loading ? '…' : (currentUser.user?.fullName ?? 'User')}
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
                      {currentUser.loading ? 'Loading…' : (currentUser.user?.fullName ?? 'User')}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {currentUser.user?.email ?? ''}
                    </p>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <IconUser className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <IconSettings className="size-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
              <IconLogout className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
