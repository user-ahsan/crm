'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  IconWebhook,
  IconPlus,
  IconTrash,
  IconPencil,
  IconSend,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconClock,
} from '@tabler/icons-react';
import type { WebhookEvent } from '@/types/webhook.types';
import { formatRelativeTime } from '@/lib/formatters';

// ── Event type definitions ────────────────────────────────────────────

const ALL_WEBHOOK_EVENTS: { value: WebhookEvent; label: string }[] = [
  { value: 'lead.created', label: 'Lead Created' },
  { value: 'lead.updated', label: 'Lead Updated' },
  { value: 'lead.deleted', label: 'Lead Deleted' },
  { value: 'lead.status_changed', label: 'Lead Status Changed' },
  { value: 'contact.created', label: 'Contact Created' },
  { value: 'contact.updated', label: 'Contact Updated' },
  { value: 'contact.deleted', label: 'Contact Deleted' },
  { value: 'company.created', label: 'Company Created' },
  { value: 'company.updated', label: 'Company Updated' },
  { value: 'company.deleted', label: 'Company Deleted' },
  { value: 'task.created', label: 'Task Created' },
  { value: 'task.completed', label: 'Task Completed' },
  { value: 'task.overdue', label: 'Task Overdue' },
  { value: 'meeting.created', label: 'Meeting Created' },
  { value: 'meeting.completed', label: 'Meeting Completed' },
];

// ── Types ─────────────────────────────────────────────────────────────

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[] | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryLog {
  id: string;
  webhookConfigId: string | null;
  event: string;
  url: string;
  status: 'success' | 'failed' | 'pending';
  responseStatus: number | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface FormData {
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = Object.fromEntries(
  ALL_WEBHOOK_EVENTS.map((e) => [e.value, e.label]),
);

const EMPTY_FORM: FormData = {
  name: '',
  url: '',
  secret: '',
  events: [],
  active: true,
};

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// ── Page Component ────────────────────────────────────────────────────

export default function WebhooksPage() {
  // Data state
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delivery logs keyed by webhook config id
  const [deliveriesByConfig, setDeliveriesByConfig] = useState<
    Record<string, DeliveryLog[]>
  >({});
  const [loadingDeliveries, setLoadingDeliveries] = useState<
    Record<string, boolean>
  >({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Test state
  const [testingId, setTestingId] = useState<string | null>(null);

  // ── Fetch configs ─────────────────────────────────────────────────

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/webhooks/config');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load webhooks (${res.status})`);
      }
      const json = await res.json();
      setConfigs(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConfigs();
  }, [fetchConfigs]);

  // ── Fetch delivery logs ─────────────────────────────────────────────

  const fetchDeliveries = useCallback(async (configId: string) => {
    if (loadingDeliveries[configId]) return;
    try {
      setLoadingDeliveries((prev) => ({ ...prev, [configId]: true }));
      const res = await fetch(
        `/api/webhooks/deliveries?webhookConfigId=${encodeURIComponent(configId)}&limit=10`,
      );
      if (!res.ok) throw new Error('Failed to load delivery logs');
      const json = await res.json();
      setDeliveriesByConfig((prev) => ({ ...prev, [configId]: json.data ?? [] }));
    } catch {
      toast.error('Failed to load delivery logs');
    } finally {
      setLoadingDeliveries((prev) => ({ ...prev, [configId]: false }));
    }
  }, [loadingDeliveries]);

  // ── Form validation ────────────────────────────────────────────────

  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!form.url.trim()) {
      errors.url = 'URL is required';
    } else if (!isValidUrl(form.url.trim())) {
      errors.url = 'Must be a valid HTTP or HTTPS URL';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  // ── Open dialog for add / edit ─────────────────────────────────────

  const openAddDialog = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((config: WebhookConfig) => {
    setEditingId(config.id);
    setForm({
      name: config.name,
      url: config.url,
      secret: config.secret ?? '',
      events: config.events ?? [],
      active: config.active,
    });
    setFormErrors({});
    setDialogOpen(true);
  }, []);

  // ── Save (create or update) ────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        url: form.url.trim(),
        events: form.events,
        active: form.active,
      };
      // Only send secret when it's non-empty
      if (form.secret.trim()) {
        body.secret = form.secret.trim();
      }

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/webhooks/config/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/webhooks/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save webhook');
      }

      toast.success(editingId ? 'Webhook updated successfully' : 'Webhook created successfully');
      setDialogOpen(false);
      setEditingId(null);
      await fetchConfigs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  }, [form, editingId, validateForm, fetchConfigs]);

  // ── Toggle active ──────────────────────────────────────────────────

  const handleToggleActive = useCallback(
    async (config: WebhookConfig) => {
      try {
        const res = await fetch(`/api/webhooks/config/${config.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !config.active }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Failed to toggle webhook');
        toast.success(`Webhook ${config.active ? 'disabled' : 'enabled'}`);
        setConfigs((prev) =>
          prev.map((c) =>
            c.id === config.id ? { ...c, active: !config.active } : c,
          ),
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to toggle webhook');
      }
    },
    [],
  );

  // ── Delete ─────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/webhooks/config/${deletingId}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to delete webhook');
      toast.success('Webhook deleted');
      setDeletingId(null);
      setConfigs((prev) => prev.filter((c) => c.id !== deletingId));
      setDeliveriesByConfig((prev) => {
        const next = { ...prev };
        delete next[deletingId];
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete webhook');
    } finally {
      setDeleting(false);
    }
  }, [deletingId]);

  // ── Test ping ──────────────────────────────────────────────────────

  const handleTest = useCallback(
    async (config: WebhookConfig) => {
      setTestingId(config.id);
      try {
        const res = await fetch('/api/webhooks/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configId: config.id,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Test request failed');

        if (json.success) {
          toast.success(
            `Test ping successful — ${json.statusCode} in ${json.durationMs}ms`,
          );
        } else {
          toast.error(
            `Test ping failed — ${json.error ?? `HTTP ${json.statusCode}`} (${json.durationMs}ms)`,
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Test request failed');
      } finally {
        setTestingId(null);
      }
    },
    [],
  );

  // ── Toggle "All Events" ────────────────────────────────────────────

  const allSelected =
    form.events.length === ALL_WEBHOOK_EVENTS.length;

  const handleToggleAllEvents = useCallback(
    (checked: boolean) => {
      setForm((prev) => ({
        ...prev,
        events: checked ? ALL_WEBHOOK_EVENTS.map((e) => e.value) : [],
      }));
    },
    [],
  );

  const handleToggleEvent = useCallback(
    (eventValue: string, checked: boolean) => {
      setForm((prev) => ({
        ...prev,
        events: checked
          ? [...prev.events, eventValue]
          : prev.events.filter((e) => e !== eventValue),
      }));
    },
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Webhooks"
          description="Manage webhook endpoints and event subscriptions."
        />
        <LoadingSkeleton type="table" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Webhooks"
          description="Manage webhook endpoints and event subscriptions."
        />
        <ErrorState
          title="Failed to load webhooks"
          message={error}
          onRetry={fetchConfigs}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description="Manage webhook endpoints and event subscriptions."
      >
        <Button onClick={openAddDialog}>
          <IconPlus size={16} className="mr-1.5" />
          Add Webhook
        </Button>
      </PageHeader>

      {configs.length === 0 ? (
        <EmptyState
          icon={<IconWebhook size={48} stroke={1.5} />}
          title="No webhooks configured"
          description="Create webhook endpoints to receive real-time event notifications for entity changes in the CRM."
          action={{ label: 'Add Webhook', onClick: openAddDialog }}
        />
      ) : (
        <div className="space-y-4">
          {configs.map((config) => {
            const eventCount = config.events?.length ?? 0;
            const allEvents = config.events === null;

            return (
              <Collapsible
                key={config.id}
                className="rounded-lg border"
                onOpenChange={(open: boolean) => {
                  if (open && !deliveriesByConfig[config.id]) {
                    fetchDeliveries(config.id);
                  }
                }}
              >
                <div className="flex items-center gap-4 px-4 py-3">
                  <CollapsibleTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" className="shrink-0" />
                    }
                  >
                    <IconChevronRight
                      size={16}
                      className="transition-transform data-open:rotate-90"
                    />
                  </CollapsibleTrigger>

                  {/* Webhook info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{config.name}</span>
                      <Badge
                        variant={config.active ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {config.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {config.url}
                    </p>
                  </div>

                  {/* Events count badge */}
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {allEvents
                      ? 'All events'
                      : `${eventCount} ${eventCount === 1 ? 'event' : 'events'}`}
                  </Badge>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTest(config)}
                      disabled={testingId === config.id}
                      title="Test webhook"
                    >
                      <IconSend size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(config)}
                      title="Edit webhook"
                    >
                      <IconPencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(config.id)}
                      title="Delete webhook"
                    >
                      <IconTrash size={15} />
                    </Button>
                    <div className="ml-2 flex items-center gap-2">
                      <Switch
                        id={`active-${config.id}`}
                        checked={config.active}
                        onCheckedChange={() => handleToggleActive(config)}
                      />
                      <Label htmlFor={`active-${config.id}`} className="sr-only">
                        Toggle webhook
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Expandable delivery log section */}
                <CollapsibleContent>
                  <div className="border-t px-4 py-3">
                    <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Recent Deliveries
                    </h4>
                    <DeliveryLogTable
                      deliveries={deliveriesByConfig[config.id]}
                      loading={loadingDeliveries[config.id] ?? false}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Dialog ──────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Webhook' : 'Add Webhook'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the webhook endpoint and event subscriptions.'
                : 'Configure a new webhook endpoint to receive CRM events.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="webhook-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="webhook-name"
                placeholder="My Webhook"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className={formErrors.name ? 'border-destructive' : ''}
              />
              {formErrors.name && (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              )}
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <Label htmlFor="webhook-url">
                URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="webhook-url"
                placeholder="https://example.com/webhook"
                value={form.url}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, url: e.target.value }))
                }
                className={formErrors.url ? 'border-destructive' : ''}
              />
              {formErrors.url && (
                <p className="text-xs text-destructive">{formErrors.url}</p>
              )}
            </div>

            {/* Secret */}
            <div className="space-y-1.5">
              <Label htmlFor="webhook-secret">
                Secret <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="webhook-secret"
                type="password"
                placeholder="Shared secret for bearer auth"
                value={form.secret}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, secret: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Sent as an Authorization: Bearer header with each request.
              </p>
            </div>

            {/* Events (multi-select checkboxes) */}
            <div className="space-y-1.5">
              <Label>Events</Label>
              <p className="text-xs text-muted-foreground">
                Select which entity events trigger this webhook.
              </p>

              {/* "All Events" toggle */}
              <label className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleToggleAllEvents}
                />
                <span className="font-medium">All Events</span>
                <span className="text-xs text-muted-foreground">
                  (Receive every event type)
                </span>
              </label>

              {/* Individual event checkboxes */}
              <div className="grid grid-cols-2 gap-1 rounded-md border p-2">
                {ALL_WEBHOOK_EVENTS.map((evt) => (
                  <label
                    key={evt.value}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={form.events.includes(evt.value)}
                      onCheckedChange={(checked: boolean) =>
                        handleToggleEvent(evt.value, checked)
                      }
                      disabled={allSelected}
                    />
                    <span>{evt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="webhook-active"
                checked={form.active}
                onCheckedChange={(checked: boolean) =>
                  setForm((prev) => ({ ...prev, active: checked }))
                }
              />
              <Label htmlFor="webhook-active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <DialogClose>
              Cancel
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Save Changes'
                  : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
        title="Delete Webhook"
        description="Are you sure you want to delete this webhook endpoint? This action cannot be undone. All associated delivery logs will be preserved."
        onConfirm={handleDelete}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        variant="destructive"
      />
    </div>
  );
}

// ── Delivery Log Sub-Component ─────────────────────────────────────────

function DeliveryLogTable({
  deliveries,
  loading,
}: {
  deliveries: DeliveryLog[] | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <IconClock size={14} className="animate-spin" />
        Loading deliveries...
      </div>
    );
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        No deliveries yet. The webhook will appear here once events have been sent.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-32">Event</TableHead>
          <TableHead className="w-20">Status</TableHead>
          <TableHead className="w-20">Code</TableHead>
          <TableHead className="w-24">Duration</TableHead>
          <TableHead>Time</TableHead>
          <TableHead className="hidden md:table-cell">Error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliveries.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="font-mono text-xs">
              {EVENT_LABELS[log.event] ?? log.event}
            </TableCell>
            <TableCell>
              {log.status === 'success' ? (
                <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-600">
                  <IconCircleCheck size={12} />
                  Success
                </Badge>
              ) : log.status === 'failed' ? (
                <Badge variant="destructive" className="gap-1">
                  <IconCircleX size={12} />
                  Failed
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <IconClock size={12} />
                  Pending
                </Badge>
              )}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {log.responseStatus ?? '—'}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {log.durationMs != null ? `${log.durationMs}ms` : '—'}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatRelativeTime(log.createdAt)}
            </TableCell>
            <TableCell className="hidden max-w-[200px] truncate text-xs text-destructive md:table-cell">
              {log.errorMessage ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
