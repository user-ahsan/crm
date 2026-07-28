import { getSharedClient } from '@/lib/supabase/client';
import type { Invoice, InvoiceFormData, InvoiceStatus } from '@/types/invoice.types';
import type { DbInvoice, DbInvoiceItem } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';
/** Generate a unique invoice number for new invoices. */
function getNextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${year}-${seq}`;
}
import { asEnum } from './supabase.service';

const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'] as const;

function mapRowToInvoice(row: DbInvoice, items: DbInvoiceItem[] = []): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    quoteId: row.quote_id ?? undefined,
    leadId: row.lead_id ?? undefined,
    contactId: row.contact_id ?? undefined,
    companyId: row.company_id ?? undefined,
    status: asEnum(row.status as string, INVOICE_STATUSES),
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    taxRate: Number(row.tax_rate),
    tax: Number(row.tax),
    total: Number(row.total),
    notes: row.notes,
    dueDate: row.due_date ?? undefined,
    paidAt: row.paid_at ?? undefined,
    paymentTerms: row.payment_terms as Invoice['paymentTerms'] | undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map(mapRowToInvoiceItem),
  };
}

function mapRowToInvoiceItem(row: DbInvoiceItem) {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
    sortOrder: row.sort_order,
  };
}

function computeTotals(items: { description: string; quantity: number; unitPrice: number }[], discount: number = 0, taxRate: number = 0) {
  for (const item of items) {
    if (item.quantity < 0) throw new ServiceError(`Negative quantity not allowed: ${item.description}`, 'INVALID_QUANTITY');
    if (item.unitPrice < 0) throw new ServiceError(`Negative unit price not allowed: ${item.description}`, 'INVALID_PRICE');
  }
  const itemTotals = items.map((i) => ({
    ...i,
    total: i.quantity * i.unitPrice,
  }));
  const subtotal = itemTotals.reduce((sum, i) => sum + i.total, 0);
  const afterDiscount = Math.max(0, subtotal - discount);
  const tax = Math.round(afterDiscount * taxRate * 100) / 100;
  const total = afterDiscount + tax;
  return { itemTotals, subtotal, tax, total };
}

export const invoiceService = {
  async getAll(page = 1, pageSize = 50): Promise<Invoice[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      return (data ?? []).map((row: DbInvoice & { invoice_items?: DbInvoiceItem[] }) =>
        mapRowToInvoice(row, row.invoice_items ?? []),
      );
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getById(id: string): Promise<Invoice | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data
        ? mapRowToInvoice(data as DbInvoice, (data as { invoice_items?: DbInvoiceItem[] }).invoice_items ?? [])
        : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getByQuoteId(quoteId: string): Promise<Invoice | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('quote_id', quoteId)
        .maybeSingle();
      if (error) throw toServiceError(error);
      return data
        ? mapRowToInvoice(data as DbInvoice, (data as { invoice_items?: DbInvoiceItem[] }).invoice_items ?? [])
        : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async create(data: InvoiceFormData): Promise<Invoice> {
    try {
      const supabase = await getSharedClient();
      const invoiceNumber = data.invoiceNumber || getNextInvoiceNumber();
      const { itemTotals, subtotal, tax, total } = computeTotals(data.items, data.discount ?? 0, data.taxRate ?? 0);

      const { data: inserted, error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          quote_id: data.quoteId || null,
          lead_id: data.leadId || null,
          contact_id: data.contactId || null,
          company_id: data.companyId || null,
          status: data.status || 'draft',
          subtotal,
          discount: data.discount ?? 0,
          tax_rate: data.taxRate ?? 0,
          tax,
          total,
          notes: data.notes || '',
          due_date: data.dueDate || null,
          payment_terms: data.paymentTerms || null,
        })
        .select()
        .single();
      if (error) throw toServiceError(error);

      const invoiceId = inserted.id;

      if (itemTotals.length > 0) {
        const { error: itemsError } = await supabase.from('invoice_items').insert(
          itemTotals.map((item, idx) => ({
            invoice_id: invoiceId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total: item.total,
            sort_order: idx,
          })),
        );
        if (itemsError) throw toServiceError(itemsError);
      }

      const invoice = await this.getById(invoiceId);
      return invoice!;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async update(id: string, data: Partial<InvoiceFormData>): Promise<Invoice | undefined> {
    try {
      const supabase = await getSharedClient();
      const existing = await this.getById(id);
      if (!existing) return undefined;

      // Only delete+re-insert items when they actually changed
      if (data.items) {
        const existingItemData = existing.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        }));
        const itemsChanged =
          existingItemData.length !== data.items.length ||
          existingItemData.some((ei, idx) => {
            const ni = data.items![idx];
            return !ni || ei.description !== ni.description || ei.quantity !== ni.quantity || ei.unitPrice !== ni.unitPrice;
          });

        if (itemsChanged) {
          const { itemTotals, subtotal, tax, total } = computeTotals(
            data.items,
            data.discount ?? existing.discount,
            data.taxRate ?? existing.taxRate,
          );

          const updateData: Record<string, unknown> = {
            subtotal,
            discount: data.discount ?? existing.discount,
            tax_rate: data.taxRate ?? existing.taxRate,
            tax,
            total,
          };
          if (data.invoiceNumber !== undefined) updateData.invoice_number = data.invoiceNumber || null;
          if (data.status !== undefined) {
            updateData.status = data.status;
            if (data.status === 'paid') updateData.paid_at = new Date().toISOString();
            if (data.status === 'draft' || data.status === 'cancelled') updateData.paid_at = null;
          }
          if (data.notes !== undefined) updateData.notes = data.notes;
          if (data.dueDate !== undefined) updateData.due_date = data.dueDate || null;
          if (data.paymentTerms !== undefined) updateData.payment_terms = data.paymentTerms || null;

          const { error: updateErr } = await supabase.from('invoices').update(updateData).eq('id', id);
          if (updateErr) throw toServiceError(updateErr);

          await supabase.from('invoice_items').delete().eq('invoice_id', id);
          if (itemTotals.length > 0) {
            const { error: itemsError } = await supabase.from('invoice_items').insert(
              itemTotals.map((item, idx) => ({
                invoice_id: id,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total: item.total,
                sort_order: idx,
              })),
            );
            if (itemsError) throw toServiceError(itemsError);
          }
        }
      } else {
        // No item changes, update only header fields
        const updateData: Record<string, unknown> = {};
        if (data.invoiceNumber !== undefined) updateData.invoice_number = data.invoiceNumber || null;
        if (data.status !== undefined) {
          updateData.status = data.status;
          if (data.status === 'paid') updateData.paid_at = new Date().toISOString();
          if (data.status === 'draft' || data.status === 'cancelled') updateData.paid_at = null;
        }
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.dueDate !== undefined) updateData.due_date = data.dueDate || null;
        if (data.paymentTerms !== undefined) updateData.payment_terms = data.paymentTerms || null;
        if (data.discount !== undefined || data.taxRate !== undefined) {
          const { subtotal, tax, total } = computeTotals(
            existing.items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
            data.discount ?? existing.discount,
            data.taxRate ?? existing.taxRate,
          );
          updateData.subtotal = subtotal;
          updateData.discount = data.discount ?? existing.discount;
          updateData.tax_rate = data.taxRate ?? existing.taxRate;
          updateData.tax = tax;
          updateData.total = total;
        }
        if (Object.keys(updateData).length > 0) {
          const { error: updateErr } = await supabase.from('invoices').update(updateData).eq('id', id);
          if (updateErr) throw toServiceError(updateErr);
        }
      }

      return this.getById(id);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      // Also delete invoice_items
      const { error: itemsErr } = await supabase.from('invoice_items').delete().eq('invoice_id', id);
      if (itemsErr) console.error(`Delete invoice_items error: ${itemsErr.message}`);
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async updateStatus(id: string, status: InvoiceStatus): Promise<Invoice | undefined> {
    try {
      const supabase = await getSharedClient();
      const updateData: Record<string, unknown> = { status };
      if (status === 'paid') updateData.paid_at = new Date().toISOString();
      if (status === 'draft' || status === 'cancelled') updateData.paid_at = null;
      const { data, error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data ? mapRowToInvoice(data as DbInvoice) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
