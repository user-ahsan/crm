export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface QuoteItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
}

export interface Quote {
  id: string;
  title: string;
  dealId?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  status: QuoteStatus;
  subtotal: number;
  discount: number;
  total: number;
  notes: string;
  validUntil?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
}

export interface QuoteFormData {
  title: string;
  dealId?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  status?: QuoteStatus;
  discount?: number;
  notes?: string;
  validUntil?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
}
