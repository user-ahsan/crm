import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SettingsState {
  displayName: string;
  email: string;
  timezone: string;
  emailNotif: boolean;
  taskReminders: boolean;
  meetingAlerts: boolean;
  setDisplayName: (name: string) => void;
  setEmail: (email: string) => void;
  setTimezone: (tz: string) => void;
  setEmailNotif: (enabled: boolean) => void;
  setTaskReminders: (enabled: boolean) => void;
  setMeetingAlerts: (enabled: boolean) => void;
  reset: () => void;
}

const DEFAULT_SETTINGS = {
  displayName: '',
  email: '',
  timezone: 'America/New_York',
  emailNotif: true,
  taskReminders: true,
  meetingAlerts: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setDisplayName: (displayName) => set({ displayName }),
      setEmail: (email) => set({ email }),
      setTimezone: (timezone) => set({ timezone }),
      setEmailNotif: (emailNotif) => set({ emailNotif }),
      setTaskReminders: (taskReminders) => set({ taskReminders }),
      setMeetingAlerts: (meetingAlerts) => set({ meetingAlerts }),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    { name: 'nexuscrm-settings' }
  )
);
