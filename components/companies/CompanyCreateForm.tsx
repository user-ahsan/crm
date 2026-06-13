'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Company, CompanyFormData, CompanySize } from '@/types/company.types';
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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useCompanies } from '@/hooks/useCompanies';
import { COMPANY_SIZES } from '@/lib/constants';
import { validateCompanyForm } from '@/lib/validators';
import { IconLoader2, IconGlobe } from '@tabler/icons-react';
import { toast } from 'sonner';

interface CompanyCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (company: Company) => void;
  editCompany?: Company;
}

interface FormErrors {
  name?: string;
  revenue?: string;
  website?: string;
}

const defaultFormData: CompanyFormData = {
  name: '',
  industry: '',
  size: undefined,
  revenue: 0,
  location: '',
  website: '',
};

export function CompanyCreateForm({ open, onOpenChange, onSuccess, editCompany }: CompanyCreateFormProps) {
  const { createCompany, updateCompany } = useCompanies();
  const [formData, setFormData] = useState<CompanyFormData>(defaultFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const isEditMode = !!editCompany;

  useEffect(() => {
    if (open) {
      if (editCompany) {
        setFormData({
          name: editCompany.name,
          industry: editCompany.industry ?? '',
          size: editCompany.size,
          revenue: editCompany.revenue,
          location: editCompany.location ?? '',
          website: editCompany.website ?? '',
        });
      } else {
        setFormData(defaultFormData);
      }
      setErrors({});
      setSubmitting(false);
    }
  }, [open, editCompany]);

  const updateField = useCallback(
    <K extends keyof CompanyFormData>(field: K, value: CompanyFormData[K]) => {
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

  const validate = useCallback((): boolean => {
    const result = validateCompanyForm(formData);
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
      // Convert empty strings to undefined for optional fields
      const payload: CompanyFormData = {
        ...formData,
        industry: formData.industry || undefined,
        location: formData.location || undefined,
        website: formData.website || undefined,
      };

      if (isEditMode && editCompany) {
        const updated = await updateCompany(editCompany.id, payload);
        if (updated) {
          toast.success('Company updated successfully');
          onSuccess?.(updated);
          onOpenChange(false);
        } else {
          toast.error('Failed to update company');
        }
      } else {
        const created = await createCompany(payload);
        if (created) {
          toast.success('Company created successfully');
          onSuccess?.(created);
          onOpenChange(false);
        } else {
          toast.error('Failed to create company');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [validate, isEditMode, editCompany, formData, createCompany, updateCompany, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Company' : 'Create New Company'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the company information below.'
              : 'Fill in the details below to add a new company.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-6 overflow-y-auto px-1">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">
              Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Acme Corp"
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
            {/* Industry */}
            <div className="grid gap-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="Technology"
                value={formData.industry}
                onChange={(e) => updateField('industry', e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Size */}
            <div className="grid gap-2">
              <Label htmlFor="size">Company Size</Label>
              <Select
                value={formData.size ?? ''}
                onValueChange={(value: string | null) => {
                  if (value === '' || value === null) {
                    updateField('size', undefined);
                  } else {
                    updateField('size', value as CompanySize);
                  }
                }}
                disabled={submitting}
              >
                <SelectTrigger id="size">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size} employees
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Revenue */}
            <div className="grid gap-2">
              <Label htmlFor="revenue">Annual Revenue ($)</Label>
              <Input
                id="revenue"
                type="number"
                min={0}
                placeholder="0"
                value={formData.revenue || ''}
                onChange={(e) =>
                  updateField('revenue', Math.max(0, Number(e.target.value)))
                }
                aria-invalid={!!errors.revenue}
                disabled={submitting}
              />
              {errors.revenue && (
                <p className="text-xs text-destructive">{errors.revenue}</p>
              )}
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
          </div>

          {/* Website */}
          <div className="grid gap-2">
            <Label htmlFor="website">Website</Label>
            <div className="relative">
              <IconGlobe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="website"
                type="url"
                placeholder="https://acme.com"
                value={formData.website}
                onChange={(e) => updateField('website', e.target.value)}
                aria-invalid={!!errors.website}
                disabled={submitting}
                className="pl-9"
              />
            </div>
            {errors.website && (
              <p className="text-xs text-destructive">{errors.website}</p>
            )}
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
            {isEditMode ? 'Save Changes' : 'Create Company'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CompanyCreateForm;
