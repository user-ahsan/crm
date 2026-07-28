export type CallDirection = 'inbound' | 'outbound';
export type CallResult = 'completed' | 'no_answer' | 'busy' | 'failed' | 'voicemail';

export interface CallLog {
  id: string;
  direction: CallDirection;
  duration: number;
  caller: string;
  callee: string;
  notes: string;
  callResult: CallResult;
  relatedToType?: string;
  relatedToId?: string;
  createdBy: string;
  createdAt: string;
}

export interface CallLogFormData {
  direction: CallDirection;
  duration?: number;
  caller: string;
  callee: string;
  notes?: string;
  callResult?: CallResult;
  relatedToType?: string;
  relatedToId?: string;
}

export interface Email {
  id: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: 'draft' | 'pending' | 'queued' | 'sent' | 'failed';
  relatedToType?: string;
  relatedToId?: string;
  sentAt?: string;
  createdAt: string;
  providerMessageId?: string;
  errorMessage?: string;
}

export interface EmailFormData {
  toAddress: string;
  subject: string;
  body: string;
  relatedToType?: string;
  relatedToId?: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  relatedToType?: string;
  relatedToId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFormData {
  title?: string;
  body: string;
  relatedToType?: string;
  relatedToId?: string;
}
