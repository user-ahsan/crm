export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface EmailSequence {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignEmail {
  id: string;
  sequenceId: string;
  subject: string;
  body: string;
  delayDays: number;
  sortOrder: number;
  createdAt: string;
}

export interface EmailSequenceFormData {
  name: string;
  description?: string;
  status?: CampaignStatus;
}

export interface CampaignEmailFormData {
  sequenceId: string;
  subject: string;
  body?: string;
  delayDays?: number;
  sortOrder?: number;
}
