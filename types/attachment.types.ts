export type RelatedEntityType = 'lead' | 'contact' | 'company' | 'deal' | 'task' | 'meeting' | 'quote';

export interface FileAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  relatedToType: RelatedEntityType;
  relatedToId: string;
  uploadedBy: string;
  createdAt: string;
}
