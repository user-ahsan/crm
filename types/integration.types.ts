export type CalendarProvider = 'google' | 'outlook';

export interface CalendarIntegration {
  id: string;
  provider: CalendarProvider;
  email: string;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CalendarIntegrationFormData {
  provider: CalendarProvider;
  email: string;
}
