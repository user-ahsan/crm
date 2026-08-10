'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Contact, ContactFormData } from '@/types/contact.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useContacts } from '@/hooks/useContacts';
import { useCompanies } from '@/hooks/useCompanies';
import { useLeads } from '@/hooks/useLeads';
import { validateContactForm } from '@/lib/validators';
import { IconX, IconPlus, IconLoader2, IconUsers, IconSearch } from '@tabler/icons-react';
import { toast } from 'sonner';

interface ContactCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (contact: Contact) => void;
  editContact?: Contact;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
}

const defaultFormData: ContactFormData = {
  name: '',
  email: '',
  phone: '',
  jobTitle: '',
  companyId: '',
  leadIds: [],
  location: '',
  socialLinks: [],
  tags: [],
  notes: '',
};

export function ContactCreateForm({ open, onOpenChange, onSuccess, editContact }: ContactCreateFormProps) {
  const { createContact, updateContact } = useContacts();
  const { companies: companiesData } = useCompanies();
  const { leads: leadsData } = useLeads();
  const [formData, setFormData] = useState<ContactFormData>(defaultFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadPopoverOpen, setLeadPopoverOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!editContact;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (open) {
      if (editContact) {
        setFormData({
          name: editContact.name,
          email: editContact.email ?? '',
          phone: editContact.phone ?? '',
          jobTitle: editContact.jobTitle ?? '',
          companyId: editContact.companyId ?? '',
          leadIds: [...editContact.leadIds],
          location: editContact.location ?? '',
          socialLinks: [...editContact.socialLinks],
          tags: [...editContact.tags],
          notes: editContact.notes ?? '',
        });
      } else {
        setFormData(defaultFormData);
      }
      setErrors({});
      setTagInput('');
      setLeadSearch('');
      setLeadPopoverOpen(false);
      setSubmitting(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editContact]);

  const filteredLeads = leadsData.filter(
    (lead) =>
      !leadSearch.trim() ||
      lead.fullName.toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.email?.toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.companyName?.toLowerCase().includes(leadSearch.toLowerCase()),
  );

  const selectedLeadIds = formData.leadIds ?? [];

  const selectedLeads = leadsData.filter((lead) => selectedLeadIds.includes(lead.id));

  const updateField = useCallback(
    <K extends keyof ContactFormData>(field: K, value: ContactFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field as keyof FormErrors];
          return next;
        });
      }
    },
    [errors]
  );

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !formData.tags.includes(trimmed)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, trimmed] }));
      setTagInput('');
    }
    tagInputRef.current?.focus();
  }, [tagInput, formData.tags]);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      } else if (e.key === 'Backspace' && tagInput === '' && formData.tags.length > 0) {
        setFormData((prev) => ({ ...prev, tags: prev.tags.slice(0, -1) }));
      }
    },
    [handleAddTag, tagInput, formData.tags]
  );

  const removeTag = useCallback((tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  }, []);

  const validate = useCallback((): boolean => {
    const result = validateContactForm(formData);
    if (!result.isValid) {
      setErrors(result.errors as FormErrors);
      return false;
    }
    return true;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isEditMode && editContact) {
        const updated = await updateContact(editContact.id, formData);
        if (updated) {
          toast.success('Contact updated successfully');
          onSuccess?.(updated);
          onOpenChange(false);
        } else {
          toast.error('Failed to update contact');
        }
      } else {
        const created = await createContact(formData);
        if (created) {
          toast.success('Contact created successfully');
          onSuccess?.(created);
          onOpenChange(false);
        } else {
          toast.error('Failed to create contact');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [validate, isEditMode, editContact, formData, createContact, updateContact, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Contact' : 'Create New Contact'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the contact information below.'
              : 'Fill in the details below to add a new contact.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-6 overflow-y-auto px-1">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              aria-invalid={!!errors.name}
              disabled={submitting}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                aria-invalid={!!errors.email}
                disabled={submitting}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                aria-invalid={!!errors.phone}
                disabled={submitting}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Job Title */}
            <div className="grid gap-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                placeholder="CTO"
                value={formData.jobTitle}
                onChange={(e) => updateField('jobTitle', e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Company */}
            <div className="grid gap-2">
              <Label htmlFor="companyId">Company</Label>
              <Select
                value={formData.companyId}
                onValueChange={(value: string | null) => { updateField('companyId', value ?? ''); }}
                disabled={submitting}
              >
                <SelectTrigger id="companyId">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No company</SelectItem>
                  {companiesData.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linked Leads */}
          <div className="grid gap-2">
            <Label>Linked Leads</Label>
            <Popover open={leadPopoverOpen} onOpenChange={setLeadPopoverOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    type="button"
                    disabled={submitting}
                    className="justify-start font-normal"
                  />
                }
              >
                <IconUsers className="mr-2 size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {selectedLeads.length > 0
                    ? selectedLeads.map((lead) => lead.fullName).join(', ')
                    : 'Select leads to link'}
                </span>
                {selectedLeads.length > 0 && (
                  <span className="ml-auto shrink-0 rounded-full bg-muted-foreground/20 px-2 py-0.5 text-xs tabular-nums">
                    {selectedLeads.length}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="start">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Link contacts to leads
                  </p>
                  <div className="relative">
                    <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search leads..."
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <div className="max-h-52 space-y-0.5 overflow-y-auto">
                    {filteredLeads.length === 0 ? (
                      <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                        No leads match your search.
                      </p>
                    ) : (
                      filteredLeads.map((lead) => {
                        const checked = selectedLeadIds.includes(lead.id);
                        return (
                          <label
                            key={lead.id}
                            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => {
                                if (checked) {
                                  updateField('leadIds', selectedLeadIds.filter((id) => id !== lead.id));
                                } else {
                                  updateField('leadIds', [...selectedLeadIds, lead.id]);
                                }
                              }}
                            />
                            <span className="flex-1 truncate">{lead.fullName}</span>
                            {lead.companyName && (
                              <span className="truncate text-xs text-muted-foreground">
                                {lead.companyName}
                              </span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Location */}
          <div className="grid gap-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="San Francisco, CA"
              value={formData.location}
              onChange={(e) => updateField('location', e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Tags */}
          <div className="grid gap-2">
            <Label htmlFor="tagInput">Tags</Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-3xl border border-transparent bg-input/50 px-3 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-muted transition-colors"
                    aria-label={`Remove tag ${tag}`}
                    disabled={submitting}
                  >
                    <IconX className="size-3" />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                id="tagInput"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={formData.tags.length === 0 ? 'Type and press Enter to add tags' : ''}
                className="min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                disabled={submitting}
              />
              {tagInput.trim() && (
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="inline-flex items-center justify-center rounded-full p-1 hover:bg-muted transition-colors"
                  aria-label="Add tag"
                  disabled={submitting}
                >
                  <IconPlus className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this contact..."
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <IconLoader2 className="mr-2 size-4 animate-spin" />}
            {submitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContactCreateForm;
