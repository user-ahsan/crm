'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { AutomationRuleFormData, AutomationTriggerEvent } from '@/types/automation.types';

const TRIGGER_EVENTS: { value: AutomationTriggerEvent; label: string }[] = [
  { value: 'lead.created', label: 'Lead Created' },
  { value: 'lead.updated', label: 'Lead Updated' },
  { value: 'lead.status_changed', label: 'Lead Status Changed' },
  { value: 'contact.created', label: 'Contact Created' },
  { value: 'contact.updated', label: 'Contact Updated' },
  { value: 'company.created', label: 'Company Created' },
  { value: 'company.updated', label: 'Company Updated' },
  { value: 'task.created', label: 'Task Created' },
  { value: 'task.completed', label: 'Task Completed' },
  { value: 'task.overdue', label: 'Task Overdue' },
  { value: 'meeting.created', label: 'Meeting Created' },
  { value: 'meeting.completed', label: 'Meeting Completed' },
  { value: 'deal.created', label: 'Deal Created' },
  { value: 'deal.stage_changed', label: 'Deal Stage Changed' },
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'changed', label: 'Changed' },
];

const ACTION_TYPES = [
  { value: 'assign_user', label: 'Assign User' },
  { value: 'change_status', label: 'Change Status' },
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'trigger_webhook', label: 'Trigger Webhook' },
];

interface CreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: AutomationRuleFormData) => Promise<void>;
  initialData?: AutomationRuleFormData;
}

export function CreateRuleDialog({ open, onOpenChange, onSave, initialData }: CreateRuleDialogProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [triggerEvent, setTriggerEvent] = useState<AutomationTriggerEvent>(initialData?.triggerEvent ?? 'lead.created');
  const [conditions, setConditions] = useState(initialData?.conditions ?? [{ field: '', operator: 'equals' as const, value: '' }]);
  const [actions, setActions] = useState(initialData?.actions ?? [{ type: 'assign_user' as const, config: {} }]);
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const isEditing = !!initialData;

  function handleAddCondition() {
    setConditions((prev) => [...prev, { field: '', operator: 'equals', value: '' }]);
  }

  function handleRemoveCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleConditionChange(index: number, key: 'field' | 'operator' | 'value', val: string) {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, [key]: val } : c)));
  }

  function handleAddAction() {
    setActions((prev) => [...prev, { type: 'assign_user', config: {} }]);
  }

  function handleRemoveAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleActionTypeChange(index: number, type: string) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, type: type as typeof a.type, config: {} } : a)));
  }

  function handleActionConfigChange(index: number, key: string, val: string) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, config: { ...a.config, [key]: val } } : a)));
  }

  function getConfigFields(type: string): { key: string; label: string; placeholder: string }[] {
    switch (type) {
      case 'assign_user':
        return [{ key: 'targetUser', label: 'User ID', placeholder: 'user-123' }];
      case 'change_status':
        return [{ key: 'status', label: 'Status', placeholder: 'qualified' }];
      case 'add_tag':
        return [{ key: 'tag', label: 'Tag Name', placeholder: 'high-priority' }];
      case 'send_email':
        return [
          { key: 'recipient', label: 'Recipient', placeholder: 'user@example.com' },
          { key: 'templateId', label: 'Template ID', placeholder: 'template-1' },
        ];
      case 'send_notification':
        return [
          { key: 'userId', label: 'User ID', placeholder: 'user-123' },
          { key: 'message', label: 'Message', placeholder: 'A new lead was created!' },
        ];
      case 'trigger_webhook':
        return [{ key: 'url', label: 'Webhook URL', placeholder: 'https://hooks.example.com/xyz' }];
      default:
        return [];
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        triggerEvent,
        conditions: conditions.filter((c) => c.field.trim()),
        actions: actions.filter((a) => a.type),
        enabled,
      });
      if (!isEditing) {
        setName('');
        setDescription('');
        setTriggerEvent('lead.created');
        setConditions([{ field: '', operator: 'equals', value: '' }]);
        setActions([{ type: 'assign_user', config: {} }]);
        setEnabled(true);
      }
      onOpenChange(false);
    } catch {
      toast.error('Failed to save rule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Rule' : 'New Automation Rule'}</DialogTitle>
          <DialogDescription>
            Define when this rule triggers and what actions to perform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Name</Label>
              <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Notify on high-value lead" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-trigger">Trigger Event</Label>
              <Select value={triggerEvent} onValueChange={(v) => v && setTriggerEvent(v as AutomationTriggerEvent)}>
                <SelectTrigger id="rule-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map((ev) => (
                    <SelectItem key={ev.value} value={ev.value}>{ev.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-description">Description</Label>
            <Textarea id="rule-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description of what this rule does" rows={2} />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Conditions</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddCondition}>Add Condition</Button>
            </div>
            {conditions.length === 0 && (
              <p className="text-sm text-muted-foreground">No conditions — rule will always trigger.</p>
            )}
            {conditions.map((condition, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Field</Label>
                  <Input value={condition.field} onChange={(e) => handleConditionChange(i, 'field', e.target.value)} placeholder="e.g. status" />
                </div>
                <div className="w-36 space-y-1">
                  <Label className="text-xs">Operator</Label>
                  <Select value={condition.operator} onValueChange={(v) => v && handleConditionChange(i, 'operator', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Value</Label>
                  <Input value={condition.value} onChange={(e) => handleConditionChange(i, 'value', e.target.value)} placeholder="e.g. qualified" />
                </div>
                <Button type="button" variant="ghost" size="sm" className="mt-5 text-destructive" onClick={() => handleRemoveCondition(i)}>Remove</Button>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Actions</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddAction}>Add Action</Button>
            </div>
            {actions.map((action, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Action Type</Label>
                    <Select value={action.type} onValueChange={(v) => v && handleActionTypeChange(i, v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((at) => (
                          <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="mt-5 text-destructive" onClick={() => handleRemoveAction(i)}>Remove</Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {getConfigFields(action.type).map((field) => (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-xs">{field.label}</Label>
                      <Input
                        value={action.config[field.key] ?? ''}
                        onChange={(e) => handleActionConfigChange(i, field.key, e.target.value)}
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="rule-enabled">Enabled</Label>
              <p className="text-xs text-muted-foreground">Toggle this rule on or off.</p>
            </div>
            <Switch id="rule-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Update Rule' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
