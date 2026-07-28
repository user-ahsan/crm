'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  IconMessage,
  IconDeviceMobileMessage,
  IconSend,
  IconCheck,
  IconX,
  IconExternalLink,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

// ─── Types ─────────────────────────────────────────────────────────────

interface TwilioConfig {
  configured: boolean;
  accountSid: string | null;
  fromNumber: string | null;
}

interface TestResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

// ─── Page Component ────────────────────────────────────────────────────

export default function SmsSettingsPage() {
  // Config state
  const [config, setConfig] = useState<TwilioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // Test SMS state
  const [testToNumber, setTestToNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Test from NexusCRM');
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const testTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cleanup test timeout on unmount
  useEffect(() => () => clearTimeout(testTimeoutRef.current), []);

  // ── Load config on mount ────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sms/config');
      if (!res.ok) {
        throw new Error('Failed to load SMS configuration');
      }
      const data: TwilioConfig = await res.json();
      setConfig(data);
      // Pre-fill form fields with current values (masked SID, empty token)
      setAccountSid(data.accountSid || '');
      setFromNumber(data.fromNumber || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig();
  }, [loadConfig]);

  // ── Save Configuration ──────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    // Client-side validation
    if (accountSid.trim() && !accountSid.trim().startsWith('AC')) {
      toast.error('Account SID must start with "AC"');
      return;
    }
    if (authToken.trim() && authToken.trim().length < 10) {
      toast.error('Auth Token appears to be too short');
      return;
    }
    if (fromNumber.trim() && !/^\+/.test(fromNumber.trim())) {
      toast.error('From Number must be in E.164 format (e.g. +15551234567)');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/sms/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: accountSid.trim(),
          authToken: authToken.trim(),
          fromNumber: fromNumber.trim(),
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success('SMS configuration saved successfully.', {
        description:
          'Twilio environment variables must be set on the server for changes to take effect. Update TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in your .env.local file.',
        duration: 6000,
      });

      // Re-check config status
      await loadConfig();
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }, [accountSid, authToken, fromNumber, loadConfig]);

  // ── Send Test SMS ───────────────────────────────────────────────────

  const handleTestSend = useCallback(async () => {
    // Validate
    if (!testToNumber.trim()) {
      toast.error('Please enter a phone number to send the test to');
      return;
    }
    if (!/^\+[1-9]\d{6,14}$/.test(testToNumber.trim())) {
      toast.error('Phone number must be in E.164 format (e.g. +15551234567)');
      return;
    }
    if (!testMessage.trim()) {
      toast.error('Please enter a test message');
      return;
    }

    setSending(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toNumber: testToNumber.trim(),
          body: testMessage.trim(),
        }),
      });

      const data: TestResult = await res.json();

      if (res.ok && data.success) {
        setTestResult(data);
        toast.success('Test SMS sent successfully!', {
          description: `Twilio Message SID: ${data.messageSid}`,
          duration: 8000,
        });
        // Clear test result after 30 seconds
        clearTimeout(testTimeoutRef.current);
        testTimeoutRef.current = setTimeout(() => setTestResult(null), 30000);
      } else {
        setTestResult({ success: false, error: data.error || 'Failed to send test SMS' });
        toast.error('Test SMS failed', {
          description: data.error || 'An unknown error occurred',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      setTestResult({ success: false, error: msg });
      toast.error('Test SMS failed', {
        description: msg,
      });
    } finally {
      setSending(false);
    }
  }, [testToNumber, testMessage]);

  // ── Loading State ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="SMS Settings"
          description="Configure your Twilio SMS integration"
        />
        <LoadingSkeleton type="card" count={2} />
      </div>
    );
  }

  // ── Error State ─────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="SMS Settings"
          description="Configure your Twilio SMS integration"
        />
        <ErrorState message={error} onRetry={loadConfig} />
      </div>
    );
  }

  const isConfigured = config?.configured ?? false;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="SMS Settings"
        description="Configure your Twilio SMS integration"
      />

      {/* ── Twilio Configuration Card ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconDeviceMobileMessage size={20} className="text-muted-foreground" />
            <CardTitle>Twilio Configuration</CardTitle>
          </div>
          <CardDescription>
            Enter your Twilio credentials. These are stored as server
            environment variables — update{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              .env.local
            </code>{' '}
            for permanent changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account SID */}
          <div className="space-y-1.5">
            <Label htmlFor="twilio-sid">Account SID</Label>
            <Input
              id="twilio-sid"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              placeholder="AC..."
              aria-label="Twilio Account SID"
            />
            <p className="text-xs text-muted-foreground">
              Found in your{' '}
              <a
                href="https://console.twilio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                Twilio Console <IconExternalLink size={10} />
              </a>
            </p>
          </div>

          {/* Auth Token */}
          <div className="space-y-1.5">
            <Label htmlFor="twilio-token">Auth Token</Label>
            <Input
              id="twilio-token"
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Enter your Auth Token"
              aria-label="Twilio Auth Token"
            />
            <p className="text-xs text-muted-foreground">
              Keep this secret. Never share or commit to version control.
            </p>
          </div>

          {/* From Number */}
          <div className="space-y-1.5">
            <Label htmlFor="twilio-from">From Number</Label>
            <Input
              id="twilio-from"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              placeholder="+15551234567"
              aria-label="Twilio From Number"
            />
            <p className="text-xs text-muted-foreground">
              A Twilio phone number in E.164 format (e.g. +15551234567).
            </p>
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              aria-label="Save Twilio configuration"
            >
              <IconDeviceFloppy size={16} className="mr-1.5" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Test SMS Card ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconMessage size={20} className="text-muted-foreground" />
            <CardTitle>Test SMS</CardTitle>
          </div>
          <CardDescription>
            Send a test message to verify your Twilio configuration is working.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Send to */}
          <div className="space-y-1.5">
            <Label htmlFor="test-to">Send to</Label>
            <Input
              id="test-to"
              value={testToNumber}
              onChange={(e) => setTestToNumber(e.target.value)}
              placeholder="+15551234567"
              aria-label="Test recipient phone number"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label htmlFor="test-message">Message</Label>
            <Input
              id="test-message"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Test from NexusCRM"
              aria-label="Test message content"
            />
          </div>

          {/* Send button + result */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleTestSend}
                disabled={sending || !isConfigured}
                aria-label="Send test SMS"
              >
                <IconSend size={16} className="mr-1.5" />
                {sending ? 'Sending...' : 'Send Test SMS'}
              </Button>
              {!isConfigured && (
                <p className="text-xs text-muted-foreground">
                  Configure Twilio credentials above first.
                </p>
              )}
            </div>

            {/* Show test result */}
            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                  testResult.success
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400'
                }`}
              >
                {testResult.success ? (
                  <>
                    <IconCheck size={16} className="shrink-0" />
                    <span className="truncate">
                      Sent! SID: {testResult.messageSid}
                    </span>
                  </>
                ) : (
                  <>
                    <IconX size={16} className="shrink-0" />
                    <span className="truncate">{testResult.error}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Status Card ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Provider</span>
            <span className="text-sm font-medium">Twilio</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Configuration</span>
            <div className="flex items-center gap-1.5">
              {isConfigured ? (
                <>
                  <IconCheck size={16} className="text-green-500" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    Configured
                  </span>
                </>
              ) : (
                <>
                  <IconX size={16} className="text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    Not Configured
                  </span>
                </>
              )}
            </div>
          </div>
          {isConfigured && config?.fromNumber && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">From Number</span>
                <span className="text-sm font-medium">{config.fromNumber}</span>
              </div>
            </>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Need credentials?</span>
            <a
              href="https://console.twilio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Open Twilio Console <IconExternalLink size={14} />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
