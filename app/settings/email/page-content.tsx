'use client';

import { useState, useEffect, useCallback } from 'react';
import { IconMail, IconCheck, IconX, IconSend, IconExternalLink, IconDeviceFloppy, IconInfoCircle } from '@tabler/icons-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Badge,
} from '@/components/ui/badge';

interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

// ── Page ──────────────────────────────────────────────────────────────

export default function EmailSettingsPage() {
  const [config, setConfig] = useState<EmailConfig>({ apiKey: '', fromEmail: '', fromName: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; messageId?: string; error?: string } | null>(null);
  const [testToAddress, setTestToAddress] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverConfigured, setServerConfigured] = useState(false);

  // Load config from server API on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/settings/email');
        if (res.ok) {
          const data = await res.json();
          setConfig({
            apiKey: data.apiKey || '',
            fromEmail: data.fromEmail || '',
            fromName: data.fromName || '',
          });
          setServerConfigured(!!data.configured);
        }
      } catch {
        // Server down — use empty defaults
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const isConfigured = config.apiKey.length > 0 && config.fromEmail.length > 0;

  const handleChange = useCallback((field: keyof EmailConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    const errors: Record<string, string> = {};

    if (!config.apiKey.trim()) {
      errors.apiKey = 'API key is required';
    }
    if (!config.fromEmail.trim()) {
      errors.fromEmail = 'From email is required';
    } else if (!config.fromEmail.includes('@')) {
      errors.fromEmail = 'Invalid email address';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setSaving(true);

    try {
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save');
      }

      toast.success('Email configuration saved successfully.');
    } catch (e) {
      toast.error('Failed to save configuration', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  }, [config]);

  const handleSendTest = useCallback(async () => {
    if (!testToAddress.trim()) {
      toast.error('Please enter a recipient email address');
      return;
    }
    if (!testToAddress.includes('@') || !testToAddress.includes('.')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setTestSending(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toAddress: testToAddress.trim() }),
      });

      const data = await res.json() as { success: boolean; messageId?: string; error?: string };

      if (data.success) {
        setTestResult({ success: true, messageId: data.messageId });
        toast.success('Test email sent successfully!');
      } else {
        setTestResult({ success: false, error: data.error ?? 'Unknown error' });
        toast.error('Test email failed', {
          description: data.error ?? 'Unknown error',
          duration: 6000,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Network error';
      setTestResult({ success: false, error: message });
      toast.error('Test email failed', { description: message });
    } finally {
      setTestSending(false);
    }
  }, [testToAddress]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Email Settings" description="Configure your Resend email integration." />
        <Card><CardContent className="p-6 text-center text-muted-foreground">Loading...</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Settings"
        description="Configure your Resend email integration for transactional emails."
      />

      {/* Email Configuration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconMail className="size-5 text-muted-foreground" />
            <CardTitle>Email Configuration</CardTitle>
          </div>
          <CardDescription>
            {serverConfigured
              ? 'Server-side environment variables are configured.'
              : 'Enter your Resend API key and default sender details. Values are stored server-side.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Key */}
          <div className="space-y-1.5">
            <Label htmlFor="api-key">
              RESEND_API_KEY
              <span className="ml-1 text-xs text-muted-foreground">(required)</span>
            </Label>
            <Input
              id="api-key"
              type="password"
              value={config.apiKey}
              onChange={(e) => { handleChange('apiKey', e.target.value); setValidationErrors({}); }}
              placeholder="re_xxxxxxxxxxxx"
              autoComplete="off"
            />
            {validationErrors.apiKey && <p className="text-red-500 text-xs">{validationErrors.apiKey}</p>}
            <p className="text-xs text-muted-foreground">
              Your Resend API key from{' '}
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                resend.com/api-keys
                <IconExternalLink className="size-3" />
              </a>
            </p>
          </div>

          {/* From Email */}
          <div className="space-y-1.5">
            <Label htmlFor="from-email">
              RESEND_FROM_EMAIL
              <span className="ml-1 text-xs text-muted-foreground">(required)</span>
            </Label>
            <Input
              id="from-email"
              type="email"
              value={config.fromEmail}
              onChange={(e) => { handleChange('fromEmail', e.target.value); setValidationErrors({}); }}
              placeholder="notifications@yourdomain.com"
            />
            {validationErrors.fromEmail && <p className="text-red-500 text-xs">{validationErrors.fromEmail}</p>}
          </div>

          {/* From Name */}
          <div className="space-y-1.5">
            <Label htmlFor="from-name">
              RESEND_FROM_NAME
              <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="from-name"
              type="text"
              value={config.fromName}
              onChange={(e) => handleChange('fromName', e.target.value)}
              placeholder="NexusCRM"
            />
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              <IconInfoCircle className="mr-1 inline size-3.5 align-text-top" />
              Values are stored server-side. Set environment variables for production use.
            </p>
            <Button onClick={handleSave} disabled={saving}>
              <IconDeviceFloppy className="mr-2 size-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Email Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconSend className="size-5 text-muted-foreground" />
            <CardTitle>Test Email</CardTitle>
          </div>
          <CardDescription>
            Send a test email to verify your Resend configuration is working.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="test-to">Send test to</Label>
            <div className="flex gap-2">
              <Input
                id="test-to"
                type="email"
                value={testToAddress}
                onChange={(e) => setTestToAddress(e.target.value)}
                placeholder="test@example.com"
                className="flex-1"
              />
              <Button onClick={handleSendTest} disabled={testSending}>
                <IconSend className="mr-2 size-4" />
                {testSending ? 'Sending…' : 'Send Test Email'}
              </Button>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`rounded-lg border p-3 ${
                testResult.success
                  ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
                  : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
              }`}
            >
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <IconCheck className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
                ) : (
                  <IconX className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                )}
                <div className="space-y-1 text-sm">
                  <p className={testResult.success ? 'font-medium text-green-800 dark:text-green-300' : 'font-medium text-red-800 dark:text-red-300'}>
                    {testResult.success ? 'Test email sent successfully' : 'Test email failed'}
                  </p>
                  {testResult.success && testResult.messageId && (
                    <p className="text-muted-foreground">
                      Provider message ID:{' '}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {testResult.messageId}
                      </code>
                    </p>
                  )}
                  {!testResult.success && testResult.error && (
                    <p className="text-muted-foreground">{testResult.error}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {serverConfigured ? 'Server Configured' : (isConfigured ? 'Configured' : 'Not Configured')}
              </p>
              <p className="text-xs text-muted-foreground">
                Provider: Resend
              </p>
            </div>
            <Badge variant={isConfigured || serverConfigured ? 'default' : 'secondary'}>
              {serverConfigured ? '✅ Server Configured' : (isConfigured ? '✅ Configured' : '⚠️ Not Configured')}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
