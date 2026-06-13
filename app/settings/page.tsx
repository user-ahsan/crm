'use client';

import { useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { useThemeStore } from '@/store/theme';
import {
  IconMoon,
  IconSun,
  IconBell,
  IconUserCircle,
  IconDeviceFloppy,
} from '@tabler/icons-react';

export default function SettingsPage() {
  const { theme, toggleTheme } = useThemeStore();

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  const handleSaveNotifications = useCallback(() => {
    // Mock: would persist notification preferences
    // Intentionally empty — this is a UI mock for future implementation
  }, []);

  const handleSaveAccount = useCallback(() => {
    // Mock: would persist account settings
    // Intentionally empty — this is a UI mock for future implementation
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your application preferences and account settings."
      />

      {/* Appearance Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <IconMoon size={20} className="text-muted-foreground" />
            ) : (
              <IconSun size={20} className="text-muted-foreground" />
            )}
            <CardTitle>Appearance</CardTitle>
          </div>
          <CardDescription>
            Customize how NexusCRM looks on your device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="theme-toggle">Dark Mode</Label>
              <p className="text-xs text-muted-foreground">
                Switch between light and dark themes.
              </p>
            </div>
            <Switch
              id="theme-toggle"
              checked={theme === 'dark'}
              onCheckedChange={handleThemeToggle}
              aria-label="Toggle dark mode"
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Notifications Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconBell size={20} className="text-muted-foreground" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure which notifications you receive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notif">Email Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Receive email updates about lead activity and task assignments.
              </p>
            </div>
            <Switch
              id="email-notif"
              defaultChecked
              aria-label="Toggle email notifications"
            />
          </div>

          <Separator />

          {/* Task Reminders */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="task-reminders">Task Reminders</Label>
              <p className="text-xs text-muted-foreground">
                Get reminded about upcoming and overdue tasks.
              </p>
            </div>
            <Switch
              id="task-reminders"
              defaultChecked
              aria-label="Toggle task reminders"
            />
          </div>

          <Separator />

          {/* Meeting Alerts */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="meeting-alerts">Meeting Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Receive alerts before scheduled meetings.
              </p>
            </div>
            <Switch
              id="meeting-alerts"
              defaultChecked
              aria-label="Toggle meeting alerts"
            />
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveNotifications}
              aria-label="Save notification settings"
            >
              <IconDeviceFloppy size={16} className="mr-1.5" />
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Account Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconUserCircle size={20} className="text-muted-foreground" />
            <CardTitle>Account</CardTitle>
          </div>
          <CardDescription>
            Manage your profile information and account security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Profile Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display Name</Label>
              <input
                id="display-name"
                type="text"
                defaultValue="Alice Johnson"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Display name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-address">Email</Label>
              <input
                id="email-address"
                type="email"
                defaultValue="alice@nexuscrm.com"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Email address"
              />
            </div>
          </div>

          <Separator />

          {/* Timezone */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="timezone">Timezone</Label>
              <p className="text-xs text-muted-foreground">
                Set your local timezone for correct scheduling.
              </p>
            </div>
            <select
              id="timezone"
              defaultValue="America/New_York"
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Select timezone"
            >
              <option value="America/New_York">Eastern Time (UTC-5)</option>
              <option value="America/Chicago">Central Time (UTC-6)</option>
              <option value="America/Denver">Mountain Time (UTC-7)</option>
              <option value="America/Los_Angeles">Pacific Time (UTC-8)</option>
              <option value="Europe/London">London (UTC+0)</option>
              <option value="Europe/Berlin">Berlin (UTC+1)</option>
              <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
            </select>
          </div>

          <Separator />

          {/* Delete Account */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-destructive">Danger Zone</Label>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                // Mock: show confirmation dialog
                // Intentionally empty — placeholder for future implementation
              }}
              aria-label="Delete account"
            >
              Delete Account
            </Button>
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveAccount}
              aria-label="Save account settings"
            >
              <IconDeviceFloppy size={16} className="mr-1.5" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
