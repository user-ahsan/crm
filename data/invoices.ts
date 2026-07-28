/**
 * MOCK DATA — Used for development/demo only.
 * Production data comes from Supabase via services/*.service.ts
 */
import type { Invoice, InvoiceTemplate } from '@/types/invoice.types';

export const invoiceTemplates: InvoiceTemplate[] = [
  {
    id: 'template-default',
    name: 'Default Professional',
    primaryColor: '#1e293b',
    accentColor: '#3b82f6',
    companyName: 'NexusCRM Inc.',
    companyAddress: '123 Business Ave, Suite 400\nSan Francisco, CA 94105',
    companyEmail: 'billing@nexuscrm.com',
    companyPhone: '+1 (555) 123-4567',
    footer: 'Thank you for your business! Payment is due within 30 days.',
    paymentTerms: 'net-30',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const invoices: Invoice[] = [
  {
    id: 'inv-001',
    invoiceNumber: 'INV-2026-0001',
    quoteId: 'quote-003',
    status: 'paid',
    subtotal: 85000,
    discount: 5000,
    taxRate: 0.08,
    tax: 6400,
    total: 86400,
    notes: 'HIPAA-compliant healthcare module. Payment received via wire transfer.',
    dueDate: '2026-07-01T00:00:00Z',
    paidAt: '2026-06-15T14:30:00Z',
    paymentTerms: 'net-30',
    createdBy: 'user-1',
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-15T14:30:00Z',
    items: [
      { id: 'ivi-001', invoiceId: 'inv-001', description: 'Healthcare Compliance Module', quantity: 1, unitPrice: 50000, total: 50000, sortOrder: 1 },
      { id: 'ivi-002', invoiceId: 'inv-001', description: 'HIPAA Audit & Certification', quantity: 1, unitPrice: 15000, total: 15000, sortOrder: 2 },
      { id: 'ivi-003', invoiceId: 'inv-001', description: 'Custom Integration Package', quantity: 1, unitPrice: 15000, total: 15000, sortOrder: 3 },
      { id: 'ivi-004', invoiceId: 'inv-001', description: 'Training & Onboarding', quantity: 1, unitPrice: 5000, total: 5000, sortOrder: 4 },
    ],
  },
  {
    id: 'inv-002',
    invoiceNumber: 'INV-2026-0002',
    quoteId: 'quote-001',
    status: 'overdue',
    subtotal: 120000,
    discount: 10000,
    taxRate: 0.08,
    tax: 8800,
    total: 118800,
    notes: 'Annual enterprise license with 500 user seats. Payment overdue.',
    dueDate: '2026-07-05T00:00:00Z',
    paymentTerms: 'net-30',
    createdBy: 'user-1',
    createdAt: '2026-06-05T10:00:00Z',
    updatedAt: '2026-06-05T10:00:00Z',
    items: [
      { id: 'ivi-005', invoiceId: 'inv-002', description: 'Enterprise License (500 seats)', quantity: 1, unitPrice: 80000, total: 80000, sortOrder: 1 },
      { id: 'ivi-006', invoiceId: 'inv-002', description: 'Premium Support (Annual)', quantity: 1, unitPrice: 30000, total: 30000, sortOrder: 2 },
      { id: 'ivi-007', invoiceId: 'inv-002', description: 'Implementation & Training', quantity: 1, unitPrice: 10000, total: 10000, sortOrder: 3 },
    ],
  },
  {
    id: 'inv-003',
    invoiceNumber: 'INV-2026-0003',
    quoteId: 'quote-002',
    status: 'draft',
    subtotal: 45000,
    discount: 5000,
    taxRate: 0.08,
    tax: 3200,
    total: 43200,
    notes: 'Mid-market subscription. Ready for review.',
    dueDate: '2026-08-01T00:00:00Z',
    paymentTerms: 'net-30',
    createdBy: 'user-2',
    createdAt: '2026-06-10T14:30:00Z',
    updatedAt: '2026-06-10T14:30:00Z',
    items: [
      { id: 'ivi-008', invoiceId: 'inv-003', description: 'Professional License (100 seats)', quantity: 1, unitPrice: 30000, total: 30000, sortOrder: 1 },
      { id: 'ivi-009', invoiceId: 'inv-003', description: 'Standard Support (Annual)', quantity: 1, unitPrice: 15000, total: 15000, sortOrder: 2 },
    ],
  },
  {
    id: 'inv-004',
    invoiceNumber: 'INV-2026-0004',
    quoteId: 'quote-004',
    status: 'cancelled',
    subtotal: 95000,
    discount: 7000,
    taxRate: 0.08,
    tax: 7040,
    total: 95040,
    notes: 'Cancelled due to client requirements change.',
    dueDate: '2026-07-15T00:00:00Z',
    paymentTerms: 'net-30',
    createdBy: 'user-2',
    createdAt: '2026-06-08T09:00:00Z',
    updatedAt: '2026-06-12T16:00:00Z',
    items: [
      { id: 'ivi-010', invoiceId: 'inv-004', description: 'Platform License (300 seats)', quantity: 1, unitPrice: 55000, total: 55000, sortOrder: 1 },
      { id: 'ivi-011', invoiceId: 'inv-004', description: 'Digital Transformation Package', quantity: 1, unitPrice: 25000, total: 25000, sortOrder: 2 },
      { id: 'ivi-012', invoiceId: 'inv-004', description: 'Data Migration Services', quantity: 1, unitPrice: 15000, total: 15000, sortOrder: 3 },
    ],
  },
  {
    id: 'inv-005',
    invoiceNumber: 'INV-2026-0005',
    quoteId: 'quote-007',
    status: 'refunded',
    subtotal: 55000,
    discount: 5000,
    taxRate: 0.08,
    tax: 4000,
    total: 54000,
    notes: 'Refunded in full due to service cancellation.',
    dueDate: '2026-06-20T00:00:00Z',
    paidAt: '2026-06-01T10:00:00Z',
    paymentTerms: 'net-15',
    createdBy: 'user-1',
    createdAt: '2026-05-20T09:30:00Z',
    updatedAt: '2026-06-10T11:00:00Z',
    items: [
      { id: 'ivi-013', invoiceId: 'inv-005', description: 'Retail License (150 seats)', quantity: 1, unitPrice: 30000, total: 30000, sortOrder: 1 },
      { id: 'ivi-014', invoiceId: 'inv-005', description: 'Inventory Management Module', quantity: 1, unitPrice: 15000, total: 15000, sortOrder: 2 },
      { id: 'ivi-015', invoiceId: 'inv-005', description: 'POS Integration', quantity: 1, unitPrice: 10000, total: 10000, sortOrder: 3 },
    ],
  },
];

// ponytail: module-level mutable state — reset on each call with Date.now() to avoid reuse across hot reloads
export function getNextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${year}-${seq}`;
}
