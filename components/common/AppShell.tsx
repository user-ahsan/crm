'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import {
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Sidebar } from '@/components/common/Sidebar';
import { TopBar } from '@/components/common/TopBar';
import { CommandPalette } from '@/components/common/CommandPalette';
import { NotificationPanel } from '@/components/common/NotificationPanel';
import { useNotifications } from '@/hooks/useNotifications';

/* ── Props ───────────────────────────────────────────────── */
export interface AppShellProps {
  children: ReactNode;
}

/* ── Component ───────────────────────────────────────────── */
export function AppShell({ children }: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
  } = useNotifications();

  const handleMenuToggle = useCallback(() => {
    setMobileSidebarOpen((prev) => !prev);
  }, []);

  const handleMobileNavClick = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  const handleCollapseToggle = useCallback(() => {
    setDesktopCollapsed((prev) => !prev);
  }, []);

  const handleSearchClick = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const handleNotificationClick = useCallback(() => {
    setNotificationOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TooltipProvider delay={400}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* ── Desktop Sidebar ─────────────────────────────── */}
        <aside
          className={cn(
            'hidden h-full shrink-0 transition-all duration-200 md:block',
            desktopCollapsed ? 'w-16' : 'w-60',
          )}
        >
          <Sidebar
            collapsed={desktopCollapsed}
            onToggleCollapse={handleCollapseToggle}
          />
        </aside>

        {/* ── Mobile Sidebar (Sheet overlay) ──────────────── */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent
            side="left"
            className="p-0"
            showCloseButton={false}
          >
            <Sidebar
              collapsed={false}
              onNavClick={handleMobileNavClick}
            />
          </SheetContent>
        </Sheet>

        {/* ── Main Content Area ───────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            onMenuToggle={handleMenuToggle}
            onSearchClick={handleSearchClick}
            onNotificationClick={handleNotificationClick}
            notificationCount={unreadCount}
          />

          <Separator />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationPanel
        open={notificationOpen}
        onOpenChange={setNotificationOpen}
        notifications={notifications}
        onMarkRead={markAsRead}
        onMarkAllRead={markAllAsRead}
        onDismiss={dismissNotification}
      />
    </TooltipProvider>
  );
}
