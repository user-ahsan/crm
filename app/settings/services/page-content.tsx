'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/common/PageHeader';
import { toast } from 'sonner';
import {
  IconMail,
  IconMessage,
  IconWebhook,
  IconHierarchy,
  IconCalendarShare,
  IconWorld,
  IconBolt,
  IconFileInvoice,
  IconSettings,
  IconLoader2,
  IconCircleCheck,
  IconCircleX,
  IconCircleMinus,
  IconEye,
} from '@tabler/icons-react';
import type { ServiceName, ServiceTestResult } from '@/lib/service-config';

interface ServiceDef {
  key: ServiceName;
  label: string;
  icon: typeof IconMail;
  description: string;
  fields: ServiceField[];
  type: 'api' | 'toggle';
}

interface ServiceField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password';
}

type StatusState = 'idle' | 'testing' | 'success' | 'fail' | 'unknown';

const SERVICES: ServiceDef[] = [
  {
    key: 'email',
    label: 'Email (Resend)',
    icon: IconMail,
    description: 'Send transactional emails via Resend API.',
    type: 'api',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 're_...', type: 'password' },
      { key: 'from_email', label: 'From Email', placeholder: 'crm@yourdomain.com' },
      { key: 'from_name', label: 'From Name', placeholder: 'NexusCRM' },
    ],
  },
  {
    key: 'sms',
    label: 'SMS (Twilio)',
    icon: IconMessage,
    description: 'Send SMS messages via Twilio.',
    type: 'api',
    fields: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'AC...', type: 'password' },
      { key: 'auth_token', label: 'Auth Token', placeholder: '...', type: 'password' },
      { key: 'from_number', label: 'From Number', placeholder: '+15551234567' },
    ],
  },
  {
    key: 'webhooks',
    label: 'Webhooks (n8n)',
    icon: IconWebhook,
    description: 'Send CRM events to n8n or any webhook endpoint.',
    type: 'api',
    fields: [
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://your-n8n.example.com/webhook/crm' },
      { key: 'webhook_secret', label: 'Secret (optional)', placeholder: 'shared-secret', type: 'password' },
    ],
  },
  {
    key: 'calendar_sync',
    label: 'Calendar Sync (Google)',
    icon: IconCalendarShare,
    description: 'Sync meetings with Google Calendar.',
    type: 'api',
    fields: [
      { key: 'google_client_id', label: 'Google Client ID', placeholder: '...apps.googleusercontent.com', type: 'password' },
      { key: 'google_client_secret', label: 'Google Client Secret', placeholder: '...', type: 'password' },
    ],
  },
  {
    key: 'portal',
    label: 'Customer Portal',
    icon: IconWorld,
    description: 'Allow external users to access shared records.',
    type: 'toggle',
    fields: [],
  },
  {
    key: 'email_sequences',
    label: 'Email Sequences',
    icon: IconHierarchy,
    description: 'Automated email drip campaigns.',
    type: 'toggle',
    fields: [],
  },
  {
    key: 'workflow_editor',
    label: 'Workflow Editor',
    icon: IconSettings,
    description: 'Visual drag-drop workflow state editor.',
    type: 'toggle',
    fields: [],
  },
  {
    key: 'realtime',
    label: 'Real-time Notifications',
    icon: IconBolt,
    description: 'WebSocket push notifications via Supabase Realtime.',
    type: 'toggle',
    fields: [],
  },
  {
    key: 'invoices',
    label: 'Invoices',
    icon: IconFileInvoice,
    description: 'Invoice creation, editing, and management.',
    type: 'toggle',
    fields: [],
  },
  {
    key: 'standalone_invoice',
    label: 'Standalone Invoice',
    icon: IconEye,
    description: 'Create invoices without requiring a quote.',
    type: 'toggle',
    fields: [],
  },
];

export default function ServicesSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Configure and test all external services. Settings saved here override environment variables."
      />
      {SERVICES.map((svc) => (
        <ServiceConfigCard key={svc.key} service={svc} />
      ))}
    </div>
  );
}

function ServiceConfigCard({ service }: { service: ServiceDef }) {
  const Icon = service.icon;
  const [config, setConfig] = useState<Record<string, string>>({});
  const [testStatus, setTestStatus] = useState<StatusState>('unknown');
  const [testResult, setTestResult] = useState<ServiceTestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Load existing config
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/service-config/${service.key}`);
        const json = await res.json();
        if (!cancelled && json.success && json.data?.config) {
          // Unmask: we only need defaults, user re-enters secrets
          setConfig(json.data.config);
        }
      } catch { /* ignore */ }
      if (!cancelled) {
        setLoading(false);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [service.key]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/service-config/${service.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${service.label} configuration saved`);
        setTestStatus('unknown');
        setTestResult(null);
      } else {
        toast.error('Failed to save', { description: json.error });
      }
    } catch (e) {
      toast.error('Failed to save', { description: e instanceof Error ? e.message : 'Network error' });
    } finally {
      setSaving(false);
    }
  }, [service, config]);

  const handleTest = useCallback(async () => {
    setTestStatus('testing');
    setTestResult(null);
    try {
      const res = await fetch(`/api/service-config/${service.key}/test`, { method: 'POST' });
      const json = await res.json();
      if (json.success && json.test) {
        setTestResult(json.test);
        setTestStatus(json.test.success ? 'success' : 'fail');
        toast[json.test.success ? 'success' : 'error'](json.test.message, {
          description: json.test.details,
        });
      } else {
        setTestStatus('fail');
        setTestResult({ success: false, message: 'Test failed', details: json.error });
        toast.error('Test failed', { description: json.error });
      }
    } catch (e) {
      setTestStatus('fail');
      setTestResult({ success: false, message: 'Network error', details: e instanceof Error ? e.message : 'Unknown' });
      toast.error('Test failed');
    }
  }, [service.key]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon size={20} className="text-muted-foreground" />
            <CardTitle className="text-base">{service.label}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={20} className="text-muted-foreground" />
            <CardTitle className="text-base">{service.label}</CardTitle>
          </div>
          <ServiceStatusBadge status={testStatus} result={testResult} />
        </div>
        <CardDescription>{service.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {service.type === 'api' ? (
          <>
            {service.fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={`${service.key}-${field.key}`}>{field.label}</Label>
                <Input
                  id={`${service.key}-${field.key}`}
                  type={field.type ?? 'text'}
                  placeholder={field.placeholder}
                  value={config[field.key] ?? ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
                {saving && <IconLoader2 className="mr-1.5 size-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testStatus === 'testing'}>
                {testStatus === 'testing' ? (
                  <IconLoader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <IconBolt className="mr-1.5 size-4" />
                )}
                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
          </>
        ) : (
          <ServiceToggleRow
            service={service}
            config={config}
            setConfig={setConfig}
            onSave={handleSave}
            onTest={handleTest}
            saving={saving}
            testing={testStatus === 'testing'}
          />
        )}

        {testResult && (
          <div className={`mt-2 rounded-md border p-2 text-xs ${
            testResult.success
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
          }`}>
            <p className="font-medium">{testResult.message}</p>
            {testResult.details && <p className="mt-0.5 opacity-80">{testResult.details}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceToggleRow({
  service, config, setConfig, onSave, onTest, saving, testing,
}: {
  service: ServiceDef;
  config: Record<string, string>;
  setConfig: (f: (prev: Record<string, string>) => Record<string, string>) => void;
  onSave: () => void;
  onTest: () => void;
  saving: boolean;
  testing: boolean;
}) {
  const enabled = config.enabled === 'true';

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor={`${service.key}-toggle`}>Enable {service.label}</Label>
          <p className="text-xs text-muted-foreground">
            {enabled ? 'Service is active' : 'Service is disabled'}
          </p>
        </div>
        <Switch
          id={`${service.key}-toggle`}
          checked={enabled}
          onCheckedChange={(v) => setConfig((prev) => ({ ...prev, enabled: v ? 'true' : 'false' }))}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="default" size="sm" onClick={onSave} disabled={saving}>
          {saving && <IconLoader2 className="mr-1.5 size-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
          {testing ? <IconLoader2 className="mr-1.5 size-4 animate-spin" /> : <IconBolt className="mr-1.5 size-4" />}
          {testing ? 'Testing...' : 'Test'}
        </Button>
      </div>
    </>
  );
}

function ServiceStatusBadge({ status, result }: { status: StatusState; result: ServiceTestResult | null }) {
  if (status === 'testing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200">
        <IconLoader2 size={12} className="animate-spin" />
        Testing...
      </span>
    );
  }
  if (status === 'success' || (status === 'unknown' && result?.success)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-200">
        <IconCircleCheck size={12} />
        Connected
      </span>
    );
  }
  if (status === 'fail') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-200">
        <IconCircleX size={12} />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      <IconCircleMinus size={12} />
      Not tested
    </span>
  );
}
