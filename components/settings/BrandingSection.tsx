'use client';

import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { IconPhoto, IconTrash, IconLoader2, IconBuilding } from '@tabler/icons-react';
import { useBranding } from '@/hooks/useBranding';

export function BrandingSection() {
  const { branding, loading, uploading, uploadLogo, removeLogo, updateCompanyName } = useBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName] = useState(branding.company_name ?? '');
  const [savingName, setSavingName] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await uploadLogo(file);
    if (ok && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveName = async () => {
    setSavingName(true);
    await updateCompanyName(companyName);
    setSavingName(false);
  };

  const handleRemove = async () => {
    await removeLogo();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconBuilding size={20} className="text-muted-foreground" />
            <CardTitle>Branding</CardTitle>
          </div>
          <CardDescription>Customize your organization&apos;s logo and branding.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <IconBuilding size={20} className="text-muted-foreground" />
          <CardTitle>Branding</CardTitle>
        </div>
        <CardDescription>
          Customize your organization&apos;s logo and company name. The logo appears in the sidebar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Logo Preview */}
        {branding.logo_url ? (
          <div className="space-y-2">
            <Label>Current Logo</Label>
            <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={branding.logo_url}
                alt="Organization logo"
                className="max-h-16 max-w-48 rounded object-contain"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                className="ml-auto shrink-0 text-destructive"
                aria-label="Remove logo"
              >
                <IconTrash size={14} className="mr-1.5" />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8">
              <div className="text-center">
                <IconPhoto size={32} className="mx-auto text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No logo uploaded</p>
              </div>
            </div>
          </div>
        )}

        {/* Upload */}
        <div className="space-y-2">
          <Label htmlFor="logo-upload">
            {branding.logo_url ? 'Replace Logo' : 'Upload Logo'}
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="logo-upload"
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
              onChange={handleFileSelect}
              disabled={uploading}
              className="max-w-sm"
            />
            {uploading && <IconLoader2 size={18} className="animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, GIF, SVG, or WebP. Max 5MB.
          </p>
        </div>

        <Separator />

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="company-name">Company Name</Label>
          <div className="flex items-center gap-3">
            <Input
              id="company-name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your Company, Inc."
              className="max-w-sm"
            />
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveName}
              disabled={savingName || !companyName.trim()}
            >
              {savingName && <IconLoader2 className="mr-1.5 size-4 animate-spin" />}
              {savingName ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
