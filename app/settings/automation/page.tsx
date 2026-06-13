'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CreateRuleDialog } from '@/components/automation/CreateRuleDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAutomation } from '@/hooks/useAutomation';
import type { AutomationRule, AutomationRuleFormData } from '@/types/automation.types';
import { formatDate } from '@/lib/formatters';
import { IconBolt, IconPlus, IconTrash, IconPencil } from '@tabler/icons-react';

const TRIGGER_LABELS: Record<string, string> = {
  'lead.created': 'Lead Created',
  'lead.updated': 'Lead Updated',
  'lead.status_changed': 'Lead Status Changed',
  'contact.created': 'Contact Created',
  'contact.updated': 'Contact Updated',
  'company.created': 'Company Created',
  'company.updated': 'Company Updated',
  'task.created': 'Task Created',
  'task.completed': 'Task Completed',
  'task.overdue': 'Task Overdue',
  'meeting.created': 'Meeting Created',
  'meeting.completed': 'Meeting Completed',
  'deal.created': 'Deal Created',
  'deal.stage_changed': 'Deal Stage Changed',
};

export default function AutomationPage() {
  const { rules, loading, error, refresh, createRule, updateRule, deleteRule } = useAutomation();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSave = useCallback(async (data: AutomationRuleFormData) => {
    if (editingRule) {
      const result = await updateRule(editingRule.id, data);
      if (result) {
        toast.success('Rule updated successfully');
      } else {
        throw new Error('Failed to update rule');
      }
    } else {
      const result = await createRule(data);
      if (result) {
        toast.success('Rule created successfully');
      } else {
        throw new Error('Failed to create rule');
      }
    }
  }, [editingRule, createRule, updateRule]);

  const handleToggle = useCallback(async (rule: AutomationRule) => {
    const result = await updateRule(rule.id, { enabled: !rule.enabled });
    if (result) {
      toast.success(`Rule ${result.enabled ? 'enabled' : 'disabled'}`);
    }
  }, [updateRule]);

  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    const success = await deleteRule(deletingId);
    if (success) {
      toast.success('Rule deleted');
      setDeletingId(null);
    } else {
      toast.error('Failed to delete rule');
    }
  }, [deletingId, deleteRule]);

  const handleEdit = useCallback((rule: AutomationRule) => {
    setEditingRule(rule);
    setCreateOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Automation Rules" description="Create and manage automated workflows." />
        <LoadingSkeleton type="card" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Automation Rules" description="Create and manage automated workflows." />
        <ErrorState title="Failed to load rules" message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Automation Rules" description="Create and manage automated workflows.">
        <Button onClick={() => { setEditingRule(null); setCreateOpen(true); }}>
          <IconPlus size={16} className="mr-1.5" />
          New Rule
        </Button>
      </PageHeader>

      {rules.length === 0 ? (
        <EmptyState
          icon={<IconBolt size={48} stroke={1.5} />}
          title="No automation rules"
          description="Automate repetitive tasks by creating rules that trigger on events like lead creation or status changes."
          action={{ label: 'Create Rule', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <IconBolt size={20} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rule.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {TRIGGER_LABELS[rule.triggerEvent] ?? rule.triggerEvent}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {rule.actions.length} {rule.actions.length === 1 ? 'action' : 'actions'}
                    </Badge>
                  </div>
                  {rule.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground truncate">{rule.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Created {formatDate(rule.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`toggle-${rule.id}`}
                      checked={rule.enabled}
                      onCheckedChange={() => handleToggle(rule)}
                    />
                    <Label htmlFor={`toggle-${rule.id}`} className="sr-only">
                      {rule.enabled ? 'Disable' : 'Enable'} rule
                    </Label>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                    <IconPencil size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingId(rule.id)}>
                    <IconTrash size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateRuleDialog
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setEditingRule(null); }}
        onSave={handleSave}
        initialData={editingRule ? {
          name: editingRule.name,
          description: editingRule.description,
          triggerEvent: editingRule.triggerEvent,
          conditions: editingRule.conditions,
          actions: editingRule.actions,
          enabled: editingRule.enabled,
        } : undefined}
      />

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        title="Delete Rule"
        description="Are you sure you want to delete this automation rule? This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
