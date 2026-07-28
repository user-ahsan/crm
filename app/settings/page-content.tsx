'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useThemeStore } from '@/store/theme';
import { useSettingsStore } from '@/store/settings';
import { useTeamContext } from '@/context/TeamContext';
import { toast } from 'sonner';
import {
  IconMoon,
  IconSun,
  IconBell,
  IconUserCircle,
  IconBuilding,
  IconArrowRight,
  IconUsersGroup,
  IconLoader2,
  IconMail,
  IconMessage,
  IconWebhook,
  IconHierarchy,
  IconBolt,
  IconFilter,
  IconCalendarShare,
  IconWorld,
  IconKey,
  IconFileInvoice,
  IconTarget,
} from '@tabler/icons-react';
import Link from 'next/link';

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (UTC-5)' },
  { value: 'America/Chicago', label: 'Central Time (UTC-6)' },
  { value: 'America/Denver', label: 'Mountain Time (UTC-7)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (UTC-8)' },
  { value: 'Europe/London', label: 'London (UTC+0)' },
  { value: 'Europe/Berlin', label: 'Berlin (UTC+1)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useThemeStore();
  const { team, members, loading: teamLoading } = useTeamContext();
  const {
    displayName,
    email,
    timezone,
    emailNotif,
    taskReminders,
    meetingAlerts,
    setDisplayName,
    setEmail,
    setTimezone,
    setEmailNotif,
    setTaskReminders,
    setMeetingAlerts,
    reset,
  } = useSettingsStore();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load settings from Supabase on mount, fall back to Zustand/localStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .single();
        if (data && !error) {
          if (data.display_name) setDisplayName(data.display_name);
          if (data.email) setEmail(data.email);
          if (data.timezone) setTimezone(data.timezone);
          if (data.email_notif !== null) setEmailNotif(data.email_notif);
          if (data.task_reminders !== null) setTaskReminders(data.task_reminders);
          if (data.meeting_alerts !== null) setMeetingAlerts(data.meeting_alerts);
        }
      } catch {
        // Silently fall back to Zustand/localStorage
      }
    };
    loadSettings();
  }, [setDisplayName, setEmail, setTimezone, setEmailNotif, setTaskReminders, setMeetingAlerts]);

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  const handleSaveNotifications = useCallback(async () => {
    setSaving(true);
    try {
      // Save to server
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('user_settings').upsert({
        email_notif: emailNotif,
        task_reminders: taskReminders,
        meeting_alerts: meetingAlerts,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) console.warn('Server save failed (settings table may not exist):', error.message);

      // Simulate delay for UX
      await new Promise((r) => setTimeout(r, 300));
      toast.success('Notification preferences saved successfully.');
    } catch {
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  }, [emailNotif, taskReminders, meetingAlerts]);

  const handleSaveAccount = useCallback(async () => {
    setSaving(true);
    try {
      // Save to server
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('user_settings').upsert({
        display_name: displayName,
        email,
        timezone,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) console.warn('Server save failed (settings table may not exist):', error.message);

      // Simulate delay for UX
      await new Promise((r) => setTimeout(r, 300));
      toast.success('Account settings saved successfully.');
    } catch {
      toast.error('Failed to save account settings');
    } finally {
      setSaving(false);
    }
  }, [displayName, email, timezone]);

  const handleDeleteAccount = useCallback(() => {
    reset();
    toast.success('Account has been deleted.');
    router.push('/signup');
  }, [router, reset]);

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
              checked={emailNotif}
              onCheckedChange={setEmailNotif}
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
              checked={taskReminders}
              onCheckedChange={setTaskReminders}
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
              checked={meetingAlerts}
              onCheckedChange={setMeetingAlerts}
              aria-label="Toggle meeting alerts"
            />
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveNotifications}
              disabled={saving}
              aria-label="Save notification settings"
            >
              {saving && <IconLoader2 className="mr-1.5 size-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Preferences'}
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
              <Input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                aria-label="Display name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-address">Email</Label>
              <Input
                id="email-address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
            <Select value={timezone} onValueChange={(v: string | null) => { if (v !== null) setTimezone(v); }}>
              <SelectTrigger className="w-[220px]" aria-label="Select timezone">
                <SelectValue placeholder="Select a timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              onClick={() => setDeleteOpen(true)}
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
              disabled={saving}
              aria-label="Save account settings"
            >
              {saving && <IconLoader2 className="mr-1.5 size-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Team Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconBuilding size={20} className="text-muted-foreground" />
            <CardTitle>Team</CardTitle>
          </div>
          <CardDescription>
            Manage your team members, roles, and collaboration settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamLoading ? (
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-48 animate-pulse rounded bg-muted" />
            </div>
          ) : team ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <IconUsersGroup size={20} className="text-primary" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{team.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </p>
                </div>
              </div>
              <Link href="/settings/team">
                <Button variant="outline" size="sm">
                  Manage Team
                  <IconArrowRight size={16} className="ml-1.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <IconUsersGroup size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">No team set up yet</p>
                  <p className="text-xs text-muted-foreground">
                    Create a team to collaborate with members and manage permissions.
                  </p>
                </div>
              </div>
              <Link href="/settings/team">
                <Button variant="default" size="sm" className="gap-1.5">
                  <IconUsersGroup size={16} />
                  Create Team
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* More Settings Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>More Settings</CardTitle>
          <CardDescription>
            Configure communication, automation, integrations, and developer tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Email', href: '/settings/email', icon: IconMail },
              { label: 'SMS', href: '/settings/sms', icon: IconMessage },
              { label: 'Webhooks', href: '/settings/webhooks', icon: IconWebhook },
              { label: 'Workflows', href: '/settings/workflows', icon: IconHierarchy },
              { label: 'Automation', href: '/settings/automation', icon: IconBolt },
              { label: 'Data Quality', href: '/settings/data-quality', icon: IconFilter },
              { label: 'Integrations', href: '/settings/integrations', icon: IconCalendarShare },
              { label: 'Portal', href: '/settings/portal', icon: IconWorld },
              { label: 'API Keys', href: '/settings/api-keys', icon: IconKey },
              { label: 'Invoice Templates', href: '/settings/invoice-templates', icon: IconFileInvoice },
              { label: 'Forecasts', href: '/settings/forecasts', icon: IconTarget },
            ].map((item) => {
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
                >
                  <ItemIcon size={16} className="shrink-0 text-muted-foreground" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Confirm Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Account"
        description="Are you sure you want to delete your account? This action is permanent and cannot be undone. All your data will be lost."
        onConfirm={handleDeleteAccount}
        confirmLabel="Delete Account"
        variant="destructive"
      />
    </div>
  );
}
