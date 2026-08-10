import { getSupabaseClient } from '@/lib/supabase/client';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_MIME_TYPES = [
  'image/*',
  'application/pdf',
  'text/*',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/zip',
  'application/gzip',
];

/**
 * Validates a file before upload.
 * Returns an error message string if invalid, or null if the file is OK.
 */
export function validateFile(file: { name: string; size: number; type: string }): string | null {
  if (!file.name) return 'File has no name.';
  if (file.size === 0) return 'File is empty.';
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = MAX_FILE_SIZE_BYTES / (1024 * 1024);
    return `File is too large. Maximum size is ${mb}MB.`;
  }
  if (file.type) {
    const allowed = ALLOWED_MIME_TYPES.some((pattern) => {
      if (pattern.endsWith('/*')) return file.type.startsWith(pattern.slice(0, -2));
      return file.type === pattern;
    });
    if (!allowed) return `File type "${file.type}" is not supported.`;
  }
  return null; // valid
}

/** Builds the public Supabase Storage URL for a file (sync). */
export function getAttachmentUrl(storagePath: string): string {
  const supabase = getSupabaseClient();
  const { data } = supabase.storage.from('attachments').getPublicUrl(storagePath);
  return data.publicUrl;
}
