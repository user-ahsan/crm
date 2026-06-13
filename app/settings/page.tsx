'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { toast } from 'sonner';
import {
  IconMoon,
  IconSun,
  IconBell,
  IconUserCircle,
  IconDeviceFloppy,
  IconBuilding,
  IconArrowRight,
} from '@tabler/icons-react';
import Link from 'next/link';

const STORAGE_KEY = 'nexuscrm-settings';

interface SettingsData {
  displayName: string;
  email: string;
  timezone: string;
  emailNotif: boolean;
  taskReminders: boolean;
  meetingAlerts: boolean;
}

const DEFAULT_SETTINGS: SettingsData = {
  displayName: 'Alice Johnson',
  email: 'alice@nexuscrm.com',
  timezone: 'America/New_York',
  emailNotif: true,
  taskReminders: true,
  meetingAlerts: true,
};

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (UTC-5)' },
  { value: 'America/Chicago', label: 'Central Time (UTC-6)' },
  { value: 'America/Denver', label: 'Mountain Time (UTC-7)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (UTC-8)' },
  { value: 'Europe/London', label: 'London (UTC+0)' },
  { value: 'Europe/Berlin', label: 'Berlin (UTC+1)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
];

function loadSettings(): SettingsData {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(data: SettingsData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useThemeStore();

  const [displayName, setDisplayName] = useState(DEFAULT_SETTINGS.displayName);
  const [email, setEmail] = useState(DEFAULT_SETTINGS.email);
  const [timezone, setTimezone] = useState(DEFAULT_SETTINGS.timezone);
  const [emailNotif, setEmailNotif] = useState(DEFAULT_SETTINGS.emailNotif);
  const [taskReminders, setTaskReminders] = useState(DEFAULT_SETTINGS.taskReminders);
  const [meetingAlerts, setMeetingAlerts] = useState(DEFAULT_SETTINGS.meetingAlerts);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = loadSettings();
    setDisplayName(saved.displayName);
    setEmail(saved.email);
    setTimezone(saved.timezone);
    setEmailNotif(saved.emailNotif);
    setTaskReminders(saved.taskReminders);
    setMeetingAlerts(saved.meetingAlerts);
  }, []);

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  const handleSaveNotifications = useCallback(() => {
    const data: SettingsData = {
      displayName,
      email,
      timezone,
      emailNotif,
      taskReminders,
      meetingAlerts,
    };
    saveSettings(data);
    toast.success('Notification preferences saved successfully.');
  }, [displayName, email, timezone, emailNotif, taskReminders, meetingAlerts]);

  const handleSaveAccount = useCallback(() => {
    const data: SettingsData = {
      displayName,
      email,
      timezone,
      emailNotif,
      taskReminders,
      meetingAlerts,
    };
    saveSettings(data);
    toast.success('Account settings saved successfully.');
  }, [displayName, email, timezone, emailNotif, taskReminders, meetingAlerts]);

  const handleDeleteAccount = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.clear();
    toast.success('Account has been deleted.');
    router.push('/signup');
  }, [router]);

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
              aria-label="Save account settings"
            >
              <IconDeviceFloppy size={16} className="mr-1.5" />
              Save Changes
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
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Team Management</p>
              <p className="text-xs text-muted-foreground">
                Invite members, assign roles, and configure team permissions.
              </p>
            </div>
            <Link href="/settings/team">
              <Button variant="outline" size="sm">
                Team Settings
                <IconArrowRight size={16} className="ml-1.5" />
              </Button>
            </Link>
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
