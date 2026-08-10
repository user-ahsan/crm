import { getSharedClient } from '@/lib/supabase/client';
import type { FileAttachment, RelatedEntityType } from '@/types/attachment.types';
import type { DbFileAttachment } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';

// File validation + URL helpers live in lib/file-utils (components must not
// import services directly); re-exported here so existing service-layer
// callers (hooks, services) keep working unchanged.
export {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  validateFile,
  getAttachmentUrl,
} from '@/lib/file-utils';

function mapRowToAttachment(row: DbFileAttachment): FileAttachment {
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    relatedToType: row.related_to_type as RelatedEntityType,
    relatedToId: row.related_to_id ?? '',
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export const attachmentService = {
  async getAttachments(relatedToType: RelatedEntityType, relatedToId: string): Promise<FileAttachment[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('file_attachments')
        .select('*')
        .eq('related_to_type', relatedToType)
        .eq('related_to_id', relatedToId)
        .order('created_at', { ascending: false });
      if (error) throw toServiceError(error);
      return data?.map(mapRowToAttachment) ?? [];
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async upload(
    file: File,
    relatedToType: RelatedEntityType,
    relatedToId: string,
    uploadedBy: string,
  ): Promise<FileAttachment> {
    try {
      const supabase = await getSharedClient();
      const storagePath = `${relatedToType}/${relatedToId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) {
        // Use error code or type check instead of fragile message matching
        if (uploadError instanceof Error && 'statusCode' in uploadError && (uploadError as { statusCode?: number }).statusCode === 404) {
          throw new ServiceError('Storage bucket "attachments" is not configured. Please contact your administrator.', 'STORAGE_BUCKET_NOT_FOUND', 404);
        }
        throw toServiceError(uploadError);
      }

      const { data: inserted, error: dbError } = await supabase
        .from('file_attachments')
        .insert({
          filename: storagePath,
          original_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          storage_path: storagePath,
          related_to_type: relatedToType,
          related_to_id: relatedToId,
          uploaded_by: uploadedBy,
        })
        .select()
        .single();
      if (dbError) {
        // Clean up storage on DB insert failure
        const { error: cleanupErr } = await supabase.storage.from('attachments').remove([storagePath]);
        if (cleanupErr) {
          console.error(`Failed to clean up storage after DB insert failure: ${cleanupErr.message}`);
        }
        throw toServiceError(dbError);
      }

      return mapRowToAttachment(inserted);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { data: existing, error: fetchError } = await supabase
        .from('file_attachments')
        .select('storage_path')
        .eq('id', id)
        .single();
      if (fetchError) {
        if (fetchError.code === 'PGRST116') return false;
        throw toServiceError(fetchError);
      }

      const { error: removeError } = await supabase.storage
        .from('attachments')
        .remove([existing.storage_path]);
      if (removeError) {
        console.error(`Storage cleanup error for attachment ${id}: ${removeError.message}`);
        // non-critical: DB record deletion proceeds even if storage cleanup fails
      }

      const { error: dbError } = await supabase
        .from('file_attachments')
        .delete()
        .eq('id', id);
      if (dbError) throw toServiceError(dbError);

      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
