export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type PaymentTerms = 'net-15' | 'net-30' | 'net-45' | 'net-60';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  title?: string;
  quoteId?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  notes: string;
  dueDate?: string;
  paidAt?: string;
  paymentTerms?: PaymentTerms;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
}

export interface InvoiceFormData {
  invoiceNumber?: string;
  title?: string;
  quoteId?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  status?: InvoiceStatus;
  discount?: number;
  taxRate?: number;
  notes?: string;
  dueDate?: string;
  paymentTerms?: PaymentTerms;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  headerLogo?: string;
  primaryColor: string;
  accentColor: string;
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  footer: string;
  paymentTerms: PaymentTerms;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceTemplateFormData {
  name: string;
  headerLogo?: string;
  primaryColor: string;
  accentColor: string;
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  footer: string;
  paymentTerms: PaymentTerms;
  isDefault?: boolean;
}
