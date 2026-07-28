'use client';

import { useState, useCallback, useEffect } from 'react';
import type { FileAttachment, RelatedEntityType } from '@/types/attachment.types';
import { generateId } from '@/lib/formatters';
import { attachmentService, validateFile } from '@/services/attachment.service';

export function useAttachments(relatedToType: RelatedEntityType, relatedToId: string) {
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await attachmentService.getAttachments(relatedToType, relatedToId);
      setAttachments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [relatedToType, relatedToId]);

  useEffect(() => {
    let cancelled = false;
    attachmentService.getAttachments(relatedToType, relatedToId)
      .then((data) => {
        if (!cancelled) setAttachments(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load attachments');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [relatedToType, relatedToId]);

  const upload = useCallback(async (file: File, uploadedBy: string) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return undefined;
    }
    const tempId = generateId();
    const optimisticItem: FileAttachment = {
      id: tempId,
      filename: file.name,
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      storagePath: '',
      relatedToType,
      relatedToId,
      uploadedBy,
      createdAt: new Date().toISOString(),
    };
    setAttachments((prev) => [optimisticItem, ...prev]);
    setUploadProgress(0);
    try {
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev === null || prev >= 90) return prev;
          return prev + 10;
        });
      }, 200);
      try {
        const created = await attachmentService.upload(file, relatedToType, relatedToId, uploadedBy);
        setUploadProgress(100);
        setAttachments((prev) => prev.map((a) => (a.id === tempId ? created : a)));
        setTimeout(() => setUploadProgress(null), 500);
        return created;
      } finally {
        clearInterval(interval);
      }
    } catch (e) {
      setAttachments((prev) => prev.filter((a) => a.id !== tempId));
      setError(e instanceof Error ? e.message : 'Failed to upload file');
      setUploadProgress(null);
      return undefined;
    }
  }, [relatedToType, relatedToId]);

  const remove = useCallback(async (id: string) => {
    let previous: FileAttachment[] | undefined;
    setAttachments((prev) => { previous = [...prev]; return prev.filter((a) => a.id !== id); });
    try {
      await attachmentService.delete(id);
      return true;
    } catch (e) {
      if (previous) setAttachments(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete attachment');
      return false;
    }
  }, []);

  return {
    attachments,
    loading,
    error,
    uploadProgress,
    refresh,
    upload,
    remove,
  };
}
