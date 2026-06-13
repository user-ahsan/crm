'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Email, EmailFormData } from '@/types/communication.types';
import { communicationService } from '@/services/communication.service';

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

  const sendEmail = useCallback(async (data: EmailFormData) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: Email = {
      id: tempId,
      fromAddress: 'crm@example.com',
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
      return created;
    } catch (e) {
      setEmails((prev) => prev.filter((e) => e.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to send email');
      return undefined;
    }
  }, []);

  const saveDraft = useCallback(async (data: EmailFormData) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: Email = {
      id: tempId,
      fromAddress: 'crm@example.com',
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

  return { emails, loading, error, refresh, sendEmail, saveDraft };
}
