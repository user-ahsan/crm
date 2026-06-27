import { getSharedClient } from '@/lib/supabase/client';
import type { Invoice, InvoiceFormData, InvoiceStatus } from '@/types/invoice.types';
import type { DbInvoice, DbInvoiceItem } from '@/types/supabase.types';
import { formatSupabaseError } from './supabase.service';
import { getNextInvoiceNumber } from '@/data/invoices';

function mapRowToInvoice(row: DbInvoice, items: DbInvoiceItem[] = []): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    quoteId: row.quote_id ?? undefined,
    leadId: row.lead_id ?? undefined,
    contactId: row.contact_id ?? undefined,
    companyId: row.company_id ?? undefined,
    status: row.status as Invoice['status'],
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
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: DbInvoice & { invoice_items?: DbInvoiceItem[] }) =>
        mapRowToInvoice(row, row.invoice_items ?? []),
      );
    } catch (e) {
      throw new Error(formatSupabaseError(e));
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
        throw new Error(error.message);
      }
      return data
        ? mapRowToInvoice(data as DbInvoice, (data as { invoice_items?: DbInvoiceItem[] }).invoice_items ?? [])
        : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
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
      if (error) throw new Error(error.message);
      return data
        ? mapRowToInvoice(data as DbInvoice, (data as { invoice_items?: DbInvoiceItem[] }).invoice_items ?? [])
        : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
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
      if (error) throw new Error(error.message);

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
        if (itemsError) throw new Error(itemsError.message);
      }

      const invoice = await this.getById(invoiceId);
      return invoice!;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async update(id: string, data: Partial<InvoiceFormData>): Promise<Invoice | undefined> {
    try {
      const supabase = await getSharedClient();
      const existing = await this.getById(id);
      if (!existing) return undefined;

      const items = data.items ?? existing.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      }));
      const discount = data.discount ?? existing.discount;
      const taxRate = data.taxRate ?? existing.taxRate;
      const { itemTotals, subtotal, tax, total } = computeTotals(items, discount, taxRate);

      const updateData: Record<string, unknown> = {
        subtotal,
        discount,
        tax_rate: taxRate,
        tax,
        total,
      };
      if (data.status !== undefined) {
        updateData.status = data.status;
        if (data.status === 'paid') updateData.paid_at = new Date().toISOString();
        if (data.status === 'draft' || data.status === 'cancelled') updateData.paid_at = null;
      }
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.dueDate !== undefined) updateData.due_date = data.dueDate || null;
      if (data.paymentTerms !== undefined) updateData.payment_terms = data.paymentTerms || null;

      const { error } = await supabase.from('invoices').update(updateData).eq('id', id);
      if (error) throw new Error(error.message);

      if (data.items) {
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
          if (itemsError) throw new Error(itemsError.message);
        }
      }

      return this.getById(id);
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
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
        throw new Error(error.message);
      }
      return data ? mapRowToInvoice(data as DbInvoice) : undefined;
    } catch (e) {
      throw new Error(formatSupabaseError(e));
    }
  },
};
