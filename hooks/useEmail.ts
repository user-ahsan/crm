'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { Email, EmailFormData } from '@/types/communication.types';
import { generateId } from '@/lib/formatters';
import { communicationService } from '@/services/communication.service';

export type SendEmailResult = { success: boolean; messageId?: string; error?: string };

const DEFAULT_FROM_ADDRESS = process.env.NEXT_PUBLIC_DEFAULT_FROM_EMAIL ?? 'crm@example.com';

export function useEmail(entityType?: string, entityId?: string) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await communicationService.getEmails(entityType, entityId);
      setEmails(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (!entityType || !entityId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await communicationService.getEmails(entityType, entityId);
        if (!cancelled) setEmails(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load emails');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  const sendEmail = useCallback(async (data: EmailFormData): Promise<Email | undefined> => {
    const tempId = generateId();
    const optimisticItem: Email = {
      id: tempId,
      fromAddress: DEFAULT_FROM_ADDRESS,
      toAddress: data.toAddress,
      subject: data.subject,
      body: data.body,
      direction: 'outbound',
      status: 'sent',
      relatedToType: data.relatedToType,
      relatedToId: data.relatedToId,
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    setEmails((prev) => [optimisticItem, ...prev]);
    try {
      const created = await communicationService.sendEmail(data);
      setEmails((prev) => prev.map((e) => (e.id === tempId ? created : e)));
      if (created.status === 'sent') {
        toast.success('Email sent', {
          description: created.providerMessageId
            ? `ID: ${created.providerMessageId.slice(0, 12)}...`
            : undefined,
        });
      } else if (created.status === 'queued') {
        toast.warning('Email queued', {
          description: created.errorMessage ?? 'Email provider not configured.',
        });
      } else if (created.status === 'failed') {
        toast.error('Email failed to send', {
          description: created.errorMessage ?? 'Unknown error',
        });
      }
      return created;
    } catch (e) {
      setEmails((prev) => prev.filter((e) => e.id !== tempId));
      const msg = e instanceof Error ? e.message : 'Failed to send email';
      setError(msg);
      toast.error('Failed to send email', { description: msg });
      return undefined;
    }
  }, []);

  const sendTestEmail = useCallback(async (toAddress: string): Promise<SendEmailResult> => {
    try {
      const result = await communicationService.sendEmail({
        toAddress,
        subject: 'Test Email from NexusCRM',
        body: 'This is a test email sent from your NexusCRM system. If you received this, email delivery is working correctly.',
        relatedToType: entityType,
        relatedToId: entityId,
      });
      if (result.status === 'sent') {
        toast.success('Test email sent successfully');
        return { success: true, messageId: result.providerMessageId };
      }
      if (result.status === 'queued') {
        toast.warning('Test email queued — no email provider configured');
        return { success: true, error: result.errorMessage };
      }
      toast.error('Test email failed', { description: result.errorMessage });
      return { success: false, error: result.errorMessage ?? 'Send failed' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send test email';
      toast.error('Test email failed', { description: msg });
      return { success: false, error: msg };
    }
  }, [entityType, entityId]);

  const saveDraft = useCallback(async (data: EmailFormData) => {
    const tempId = generateId();
    const optimisticItem: Email = {
      id: tempId,
      fromAddress: DEFAULT_FROM_ADDRESS,
      toAddress: data.toAddress,
      subject: data.subject,
      body: data.body,
      direction: 'outbound',
      status: 'draft',
      relatedToType: data.relatedToType,
      relatedToId: data.relatedToId,
      createdAt: new Date().toISOString(),
    };
    setEmails((prev) => [optimisticItem, ...prev]);
    try {
      const created = await communicationService.saveDraft(data);
      setEmails((prev) => prev.map((e) => (e.id === tempId ? created : e)));
      return created;
    } catch (e) {
      setEmails((prev) => prev.filter((e) => e.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to save draft');
      return undefined;
    }
  }, []);

  return { emails, loading, error, refresh, sendEmail, saveDraft, sendTestEmail };
}
