'use client';

import { useRef, useCallback, useState } from 'react';
import type { RelatedEntityType, FileAttachment } from '@/types/attachment.types';
import { useAttachments } from '@/hooks/useAttachments';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatRelativeTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  validateFile,
  MAX_FILE_SIZE_BYTES,
  getAttachmentUrl,
} from '@/lib/file-utils';
import {
  IconFile,
  IconFileText,
  IconFileTypeCsv,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileTypeZip,
  IconPhoto,
  IconMovie,
  IconMusic,
  IconTrash,
  IconUpload,
  IconPaperclip,
  IconX,
} from '@tabler/icons-react';

interface FileAttachmentListProps {
  relatedToType: RelatedEntityType;
  relatedToId: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <IconPhoto className="size-5 text-blue-500" />;
  if (mimeType.startsWith('video/')) return <IconMovie className="size-5 text-purple-500" />;
  if (mimeType.startsWith('audio/')) return <IconMusic className="size-5 text-green-500" />;
  if (mimeType === 'application/pdf') return <IconFileTypePdf className="size-5 text-red-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return <IconFileTypeCsv className="size-5 text-green-600" />;
  if (mimeType.includes('document') || mimeType.includes('word')) return <IconFileTypeDoc className="size-5 text-blue-600" />;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('7z')) return <IconFileTypeZip className="size-5 text-orange-500" />;
  if (mimeType.startsWith('text/')) return <IconFileText className="size-5 text-gray-500" />;
  return <IconFile className="size-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);

export function FileAttachmentList({ relatedToType, relatedToId }: FileAttachmentListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<FileAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const { attachments, loading, error, uploadProgress, refresh, upload, remove } = useAttachments(relatedToType, relatedToId);
  const { user } = useCurrentUser();

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const errorMsg = validateFile(file);
    if (errorMsg) {
      toast.error(errorMsg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingFileName(file.name);
    await upload(file, user?.id ?? 'user-1');
    setUploadingFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [upload, user]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this file?')) return;
    await remove(id);
  }, [remove]);

  const handleImageClick = useCallback((attachment: FileAttachment) => {
    if (!attachment.mimeType.startsWith('image/')) return;
    // ponytail: getPublicUrl is sync — no await needed
    const url = getAttachmentUrl(attachment.storagePath);
    setPreviewUrl(url);
    setPreviewAttachment(attachment);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewUrl(null);
    setPreviewAttachment(null);
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
            <Skeleton className="size-10 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Files {attachments.length > 0 && <span className="text-muted-foreground">({attachments.length})</span>}
        </h3>
        <Button size="sm" onClick={handleUploadClick}>
          <IconUpload className="size-4" />
          Upload
        </Button>
      </div>

      {uploadProgress !== null && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconUpload className="size-4 animate-pulse" />
            <span className="truncate max-w-[200px]">
              {uploadingFileName ?? 'Uploading...'}
            </span>
          </div>
          <Progress value={uploadProgress} className="h-1.5" />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Max file size: {MAX_FILE_SIZE_MB}MB
      </p>

      {attachments.length === 0 ? (
        <EmptyState
          icon={<IconPaperclip className="size-10" />}
          title="No files"
          description={`No files have been attached yet. Upload a file to get started (max ${MAX_FILE_SIZE_MB}MB).`}
          action={{ label: 'Upload File', onClick: handleUploadClick }}
        />
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
            >
              <button
                type="button"
                className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted transition-colors hover:bg-muted/80"
                onClick={() => handleImageClick(attachment)}
                title={attachment.mimeType.startsWith('image/') ? 'Preview image' : attachment.originalName}
              >
                {getFileIcon(attachment.mimeType)}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {attachment.originalName}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(attachment.sizeBytes)}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(attachment.createdAt)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(attachment.id)}
                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Delete file"
              >
                <IconTrash className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox for image preview */}
      <Dialog open={previewUrl !== null} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent
          className="max-w-[90vw] sm:max-w-[90vw] max-h-[90vh] overflow-hidden p-0"
          showCloseButton={false}
        >
          <div className="flex flex-col max-h-[90vh]">
            <div className="relative flex flex-1 items-center justify-center bg-black/5 p-4 min-h-0">
              {/* ponytail: native img tag for preview, no lightbox library needed */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl ?? ''}
                alt={previewAttachment?.originalName ?? ''}
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
              <button
                type="button"
                onClick={closePreview}
                className="absolute top-3 right-3 rounded-full bg-background/80 p-1.5 text-muted-foreground shadow-xs transition-colors hover:bg-background hover:text-foreground"
              >
                <IconX className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
              <span className="font-medium truncate text-foreground">
                {previewAttachment?.originalName}
              </span>
              <span className="shrink-0">
                {previewAttachment ? formatFileSize(previewAttachment.sizeBytes) : ''}
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide">
                {previewAttachment?.mimeType}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FileAttachmentList;
