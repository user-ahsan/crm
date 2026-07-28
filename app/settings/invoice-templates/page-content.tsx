'use client';

import { useState, useCallback, useEffect } from 'react';
import type { InvoiceTemplate, InvoiceTemplateFormData, PaymentTerms } from '@/types/invoice.types';
import { getSupabaseClient } from '@/lib/supabase/client';

const defaultTemplates: InvoiceTemplate[] = [
  {
    id: 'default', name: 'Default', primaryColor: '#1e293b', accentColor: '#3b82f6',
    companyName: '', companyAddress: '', companyEmail: '', companyPhone: '',
    footer: 'Thank you for your business!', paymentTerms: 'net-30', isDefault: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { IconPlus, IconEdit, IconTrash, IconFileInvoice, IconCheck, IconPhotoUp } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

const PAYMENT_TERMS: { value: PaymentTerms; label: string }[] = [
  { value: 'net-15', label: 'Net 15' },
  { value: 'net-30', label: 'Net 30' },
  { value: 'net-45', label: 'Net 45' },
  { value: 'net-60', label: 'Net 60' },
];

const defaultFormData: InvoiceTemplateFormData = {
  name: '',
  primaryColor: '#1e293b',
  accentColor: '#3b82f6',
  companyName: '',
  companyAddress: '',
  companyEmail: '',
  companyPhone: '',
  footer: 'Thank you for your business! Payment is due within 30 days.',
  paymentTerms: 'net-30',
  isDefault: false,
};

export default function InvoiceTemplatesPage() {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(defaultTemplates);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceTemplateFormData>(defaultFormData);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Load templates from Supabase on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('invoice_templates')
          .select('*')
          .order('created_at');
        if (data && !error && data.length > 0) {
          setTemplates(data as InvoiceTemplate[]);
        }
      } catch {
        // Silently fall back to in-memory defaults
      }
    };
    loadTemplates();
  }, []);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(defaultFormData);
    setLogoPreview(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((template: InvoiceTemplate) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      headerLogo: template.headerLogo,
      primaryColor: template.primaryColor,
      accentColor: template.accentColor,
      companyName: template.companyName,
      companyAddress: template.companyAddress,
      companyEmail: template.companyEmail,
      companyPhone: template.companyPhone,
      footer: template.footer,
      paymentTerms: template.paymentTerms,
      isDefault: template.isDefault,
    });
    setLogoPreview(template.headerLogo || null);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setDialogOpen(false);
      setTimeout(() => setEditingId(null), 300);
    }
  }, []);

  const updateField = useCallback(<K extends keyof InvoiceTemplateFormData>(
    key: K, value: InvoiceTemplateFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleLogoUrlChange = useCallback((url: string) => {
    updateField('headerLogo', url || undefined);
    setLogoPreview(url || null);
  }, [updateField]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    setSaving(true);

    try {
      const supabase = getSupabaseClient();

      if (editingId) {
        const updated: Partial<InvoiceTemplate> = {
          ...form,
          headerLogo: form.headerLogo || undefined,
          updatedAt: new Date().toISOString(),
        };

        // Persist to Supabase
        const { error } = await supabase.from('invoice_templates').update(updated).eq('id', editingId);
        if (error) throw error;

        // Update local state
        setTemplates((prev) =>
          prev.map((t) => {
            if (t.id !== editingId) return t;
            return { ...t, ...updated } as InvoiceTemplate;
          }),
        );
        // If setting this as default, unmark others
        if (form.isDefault) {
          setTemplates((prev) =>
            prev.map((t) => (t.id !== editingId ? { ...t, isDefault: false } : t)),
          );
        }
        toast.success('Template updated successfully');
      } else {
        const newTemplate: InvoiceTemplate = {
          id: `template-${Date.now()}`,
          ...form,
          headerLogo: form.headerLogo || undefined,
          isDefault: form.isDefault || templates.length === 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Persist to Supabase
        const { error } = await supabase.from('invoice_templates').insert(newTemplate);
        if (error) throw error;

        // Update local state
        setTemplates((prev) => {
          const updated = form.isDefault || prev.length === 0
            ? prev.map((t) => ({ ...t, isDefault: false }))
            : prev;
          return [...updated, newTemplate];
        });
        toast.success('Template created successfully');
      }

      await new Promise((r) => setTimeout(r, 300));
    } catch {
      toast.error('Failed to save template to server');
    } finally {
      setSaving(false);
      setDialogOpen(false);
      setTimeout(() => setEditingId(null), 300);
    }
  }, [form, editingId, templates]);

  const handleDelete = useCallback((id: string) => {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    toast(`Delete "${template.name}"?`, {
      description: 'This action cannot be undone.',
      duration: 5000,
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            const supabase = getSupabaseClient();
            const { error } = await supabase.from('invoice_templates').delete().eq('id', id);
            if (error) throw error;
            setTemplates((prev) => prev.filter((t) => t.id !== id));
            toast.success('Template deleted');
          } catch {
            toast.error('Failed to delete template from server');
          }
        },
      },
    });
  }, [templates]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Templates"
        description="Manage your invoice template layouts, branding, and company information."
      >
        <Button onClick={openCreate}>
          <IconPlus className="mr-2 size-4" />
          New Template
        </Button>
      </PageHeader>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 text-muted-foreground">
            <IconFileInvoice size={48} stroke={1.5} />
          </div>
          <h3 className="mb-1 text-lg font-semibold">No templates yet</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            Create your first invoice template to start generating branded PDF invoices.
          </p>
          <Button variant="outline" onClick={openCreate}>
            <IconPlus className="mr-2 size-4" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className={cn(template.isDefault && 'ring-2 ring-primary/30')}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Color preview */}
                    <div className="flex size-10 items-center justify-center rounded-lg overflow-hidden">
                      <div
                        className="size-full"
                        style={{ backgroundColor: template.primaryColor }}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{template.name}</CardTitle>
                      {template.isDefault && (
                        <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0 h-4">
                          <IconCheck size={10} className="mr-0.5" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Primary:</span>
                  <span className="font-mono">{template.primaryColor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Accent:</span>
                  <span className="font-mono">{template.accentColor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Company:</span>
                  <span>{template.companyName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Terms:</span>
                  <span>{template.paymentTerms.replace('net-', 'Net ')}</span>
                </div>
                {template.headerLogo && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Logo:</span>
                    <span className="truncate max-w-[120px]">Uploaded</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-3 flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(template)}>
                  <IconEdit className="mr-1 size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(template.id)}
                >
                  <IconTrash className="mr-1 size-3.5" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update your invoice template branding and company information.'
                : 'Set up a new invoice template with your branding.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Template Name */}
            <div className="grid gap-2">
              <Label htmlFor="templateName">
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="templateName"
                placeholder="Professional Blue"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>

            <Separator />

            {/* Branding Colors */}
            <div>
              <h4 className="text-sm font-medium mb-3">Branding Colors</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="primaryColor"
                      value={form.primaryColor}
                      onChange={(e) => updateField('primaryColor', e.target.value)}
                      className="size-10 cursor-pointer rounded border border-border bg-transparent"
                    />
                    <Input
                      value={form.primaryColor}
                      onChange={(e) => updateField('primaryColor', e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="accentColor"
                      value={form.accentColor}
                      onChange={(e) => updateField('accentColor', e.target.value)}
                      className="size-10 cursor-pointer rounded border border-border bg-transparent"
                    />
                    <Input
                      value={form.accentColor}
                      onChange={(e) => updateField('accentColor', e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Header Logo */}
            <div className="grid gap-2">
              <Label>Header Logo</Label>
              <p className="text-xs text-muted-foreground">
                Enter a URL to your company logo image, or leave empty to use the default logo placeholder.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="https://example.com/logo.png"
                    value={form.headerLogo || ''}
                    onChange={(e) => handleLogoUrlChange(e.target.value)}
                  />
                </div>
                {logoPreview ? (
                  <div className="size-14 flex-shrink-0 rounded-lg border overflow-hidden bg-muted/30 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="max-h-12 max-w-12 object-contain"
                      onError={() => setLogoPreview(null)}
                    />
                  </div>
                ) : (
                  <div className="size-14 flex-shrink-0 rounded-lg border border-dashed bg-muted/20 flex items-center justify-center">
                    <IconPhotoUp size={20} className="text-muted-foreground/50" />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Company Information */}
            <div>
              <h4 className="text-sm font-medium mb-3">Company Information</h4>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="Your Company Inc."
                    value={form.companyName}
                    onChange={(e) => updateField('companyName', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="companyAddress">Address</Label>
                  <Textarea
                    id="companyAddress"
                    placeholder="123 Business St&#10;City, State 12345"
                    value={form.companyAddress}
                    onChange={(e) => updateField('companyAddress', e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="companyEmail">Email</Label>
                    <Input
                      id="companyEmail"
                      placeholder="billing@company.com"
                      value={form.companyEmail}
                      onChange={(e) => updateField('companyEmail', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="companyPhone">Phone</Label>
                    <Input
                      id="companyPhone"
                      placeholder="+1 (555) 123-4567"
                      value={form.companyPhone}
                      onChange={(e) => updateField('companyPhone', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Footer & Settings */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="footer">Footer Text</Label>
                <Input
                  id="footer"
                  placeholder="Thank you for your business!"
                  value={form.footer}
                  onChange={(e) => updateField('footer', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="paymentTerms">Default Payment Terms</Label>
                  <Select
                    value={form.paymentTerms}
                    onValueChange={(v: string | null) => { if (v) updateField('paymentTerms', v as PaymentTerms); }}
                  >
                    <SelectTrigger id="paymentTerms">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center justify-between w-full">
                    <Label htmlFor="isDefault">Set as default template</Label>
                    <Switch
                      id="isDefault"
                      checked={form.isDefault || false}
                      onCheckedChange={(v: boolean) => updateField('isDefault', v)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => handleDialogClose(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
