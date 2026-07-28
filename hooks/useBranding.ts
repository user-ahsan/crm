'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface BrandingSettings {
  logo_url: string | null;
  logo_path: string | null;
  company_name: string | null;
}

const DEFAULT_BRANDING: BrandingSettings = {
  logo_url: null,
  logo_path: null,
  company_name: null,
};

/**
 * Hook to manage organization branding (logo + company name).
 * Fetches on mount, provides upload/remove/update actions.
 */
export function useBranding() {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/branding');
      const json = await res.json();
      if (json.success && json.data) {
        setBranding({
          logo_url: json.data.logo_url ?? null,
          logo_path: json.data.logo_path ?? null,
          company_name: json.data.company_name ?? null,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load branding');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const uploadLogo = useCallback(async (file: File): Promise<boolean> => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum size is 5MB.' });
      return false;
    }

    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Invalid file type', { description: 'Supported: PNG, JPEG, GIF, SVG, WebP.' });
      return false;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/branding/logo', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!json.success) {
        toast.error('Upload failed', { description: json.error ?? 'Unknown error' });
        return false;
      }

      setBranding(prev => ({
        ...prev,
        logo_url: json.data.logo_url,
        logo_path: json.data.logo_path,
      }));

      toast.success('Logo uploaded successfully');
      return true;
    } catch (e) {
      toast.error('Upload failed', { description: e instanceof Error ? e.message : 'Network error' });
      return false;
    } finally {
      setUploading(false);
    }
  }, []);

  const removeLogo = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/branding/logo', { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        toast.error('Failed to remove logo', { description: json.error });
        return false;
      }

      setBranding(prev => ({ ...prev, logo_url: null, logo_path: null }));
      toast.success('Logo removed');
      return true;
    } catch (e) {
      toast.error('Failed to remove logo', { description: e instanceof Error ? e.message : 'Network error' });
      return false;
    }
  }, []);

  const updateCompanyName = useCallback(async (companyName: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error('Failed to save', { description: json.error });
        return false;
      }

      setBranding(prev => ({ ...prev, company_name: companyName }));
      toast.success('Company name saved');
      return true;
    } catch (e) {
      toast.error('Failed to save', { description: e instanceof Error ? e.message : 'Network error' });
      return false;
    }
  }, []);

  return {
    branding,
    loading,
    error,
    uploading,
    uploadLogo,
    removeLogo,
    updateCompanyName,
    refresh,
  };
}
