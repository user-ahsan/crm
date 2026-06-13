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
import { useContacts } from '@/hooks/useContacts';
import { companies } from '@/data/companies';
import { validateContactForm } from '@/lib/validators';
import { IconX, IconPlus, IconLoader2 } from '@tabler/icons-react';
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
}

const defaultFormData: ContactFormData = {
  name: '',
  email: '',
  phone: '',
  jobTitle: '',
  companyId: '',
  location: '',
  socialLinks: [],
  tags: [],
  notes: '',
};

export function ContactCreateForm({ open, onOpenChange, onSuccess, editContact }: ContactCreateFormProps) {
  const { createContact, updateContact } = useContacts();
  const [formData, setFormData] = useState<ContactFormData>(defaultFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!editContact;

  useEffect(() => {
    if (open) {
      if (editContact) {
        setFormData({
          name: editContact.name,
          email: editContact.email ?? '',
          phone: editContact.phone ?? '',
          jobTitle: editContact.jobTitle ?? '',
          companyId: editContact.companyId ?? '',
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
      setSubmitting(false);
    }
  }, [open, editContact]);

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
        const updated = updateContact(editContact.id, formData);
        if (updated) {
          toast.success('Contact updated successfully');
          onSuccess?.(updated);
          onOpenChange(false);
        } else {
          toast.error('Failed to update contact');
        }
      } else {
        const created = createContact(formData);
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
                disabled={submitting}
              />
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
                onValueChange={(value: string | null) => { if (value) updateField('companyId', value); }}
                disabled={submitting}
              >
                <SelectTrigger id="companyId">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            {submitting && <IconLoader2 className="size-4 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Create Contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContactCreateForm;
