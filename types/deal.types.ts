export interface DealStage {
  id: string;
  name: string;
  color: string;
  probability: number;
  sortOrder: number;
  createdAt: string;
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  value: number;
  currency: string;
  stageId?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  assignedTo?: string;
  closeDate?: string;
  winLossReason: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  stage?: DealStage;
}

export interface DealFormData {
  title: string;
  description?: string;
  value?: number;
  currency?: string;
  stageId?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  assignedTo?: string;
  closeDate?: string;
  tags?: string[];
}

export interface DealStageFormData {
  name: string;
  color?: string;
  probability?: number;
  sortOrder?: number;
}
