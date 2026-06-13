export type SmsDirection = 'inbound' | 'outbound';
export type SmsStatus = 'sent' | 'delivered' | 'failed';
export type SmsRelatedEntity = 'lead' | 'contact' | 'company' | 'deal';

export interface SmsLog {
  id: string;
  toNumber: string;
  fromNumber: string;
  body: string;
  direction: SmsDirection;
  status: SmsStatus;
  relatedToType?: SmsRelatedEntity;
  relatedToId?: string;
  createdBy: string;
  createdAt: string;
}

export interface SmsFormData {
  toNumber: string;
  fromNumber?: string;
  body: string;
  relatedToType?: SmsRelatedEntity;
  relatedToId?: string;
}
