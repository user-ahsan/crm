'use client';

import { useState, useCallback, useEffect } from 'react';
import type { InvoiceTemplate } from '@/types/invoice.types';
import { getSupabaseClient } from '@/lib/supabase/client';

/**
 * Loads invoice templates from Supabase and exposes the default template
 * for the PDF path. Row mapping converts snake_case DB columns to the
 * camelCase InvoiceTemplate shape — the page used to `as InvoiceTemplate[]`
 * the raw rows which left field access returning undefined (F27 §6).
 */
function mapRow(row: Record<string, unknown>): InvoiceTemplate {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    name: typeof row.name === 'string' ? row.name : '',
    headerLogo: typeof row.header_logo === 'string' ? row.header_logo : (typeof row.headerLogo === 'string' ? row.headerLogo : undefined),
    primaryColor: typeof row.primary_color === 'string' ? row.primary_color : (typeof row.primaryColor === 'string' ? row.primaryColor : '#1e293b'),
    accentColor: typeof row.accent_color === 'string' ? row.accent_color : (typeof row.accentColor === 'string' ? row.accentColor : '#3b82f6'),
    companyName: typeof row.company_name === 'string' ? row.company_name : (typeof row.companyName === 'string' ? row.companyName : ''),
    companyAddress: typeof row.company_address === 'string' ? row.company_address : (typeof row.companyAddress === 'string' ? row.companyAddress : ''),
    companyEmail: typeof row.company_email === 'string' ? row.company_email : (typeof row.companyEmail === 'string' ? row.companyEmail : ''),
    companyPhone: typeof row.company_phone === 'string' ? row.company_phone : (typeof row.companyPhone === 'string' ? row.companyPhone : ''),
    footer: typeof row.footer === 'string' ? row.footer : '',
    paymentTerms: (typeof row.payment_terms === 'string' ? row.payment_terms : (typeof row.paymentTerms === 'string' ? row.paymentTerms : 'net-30')) as InvoiceTemplate['paymentTerms'],
    isDefault: Boolean(row.is_default ?? row.isDefault),
    createdAt: typeof row.created_at === 'string' ? row.created_at : (typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString()),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : (typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString()),
  };
}

const FALLBACK_TEMPLATE: InvoiceTemplate = {
  id: 'default',
  name: 'Default',
  primaryColor: '#1e293b',
  accentColor: '#3b82f6',
  companyName: '',
  companyAddress: '',
  companyEmail: '',
  companyPhone: '',
  footer: 'Thank you for your business!',
  paymentTerms: 'net-30',
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function useInvoiceTemplates() {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: err } = await supabase
        .from('invoice_templates')
        .select('*')
        .order('created_at');
      if (err) throw err;
      const mapped = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
      setTemplates(mapped);
    } catch (e) {
      // ponytail: silent fallback — PDF path always needs a template, so the
      // consumer uses defaultTemplate from getDefault(). Real error surfaces
      // only when templates page (with CRUD + retry) needs it.
      setTemplates([]);
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const getDefault = useCallback((): InvoiceTemplate => {
    return templates.find((t) => t.isDefault) ?? templates[0] ?? FALLBACK_TEMPLATE;
  }, [templates]);

  return { templates, loading, error, refresh, getDefault };
}

export { FALLBACK_TEMPLATE };
