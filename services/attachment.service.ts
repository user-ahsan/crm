import { getSharedClient } from '@/lib/supabase/client';
import type { FileAttachment, RelatedEntityType } from '@/types/attachment.types';
import type { DbFileAttachment } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';

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
      if (error) throw new Error(error.message);
      return data?.map(mapRowToAttachment) ?? [];
    } catch (e) {
      throw new Error(formatSupabaseError(e));
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
        if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
          throw new Error('Storage bucket "attachments" is not configured. Please contact your administrator.');
        }
        throw new Error(uploadError.message);
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
        await supabase.storage.from('attachments').remove([storagePath]);
        throw new Error(dbError.message);
      }

      return mapRowToAttachment(inserted);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
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
        throw new Error(fetchError.message);
      }

      const { error: removeError } = await supabase.storage
        .from('attachments')
        .remove([existing.storage_path]);
      if (removeError) {
        // non-critical: DB record deletion proceeds even if storage cleanup fails
      }

      const { error: dbError } = await supabase
        .from('file_attachments')
        .delete()
        .eq('id', id);
      if (dbError) throw new Error(dbError.message);

      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
