import { getSharedClient } from '@/lib/supabase/client';
import type { SharedSupabaseClient } from '@/lib/supabase/client';
import type { Invoice, InvoiceFormData, InvoiceStatus, PaymentTerms } from '@/types/invoice.types';
import type { DbInvoice, DbInvoiceItem, InvoiceInsert, InvoiceUpdate } from '@/types/supabase.types';
import { asEnum, ServiceError, toServiceError } from './supabase.service';
import { USERS } from '@/data/mock-users';

const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'] as const;
const PAYMENT_TERMS_VALUES = ['net-15', 'net-30', 'net-45', 'net-60'] as const;

/** Unique-violation retry budget for sequential invoice numbers (23505). */
const INVOICE_NUMBER_MAX_ATTEMPTS = 3;

type InvoiceWithItemsRow = DbInvoice & { invoice_items?: DbInvoiceItem[] };

interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Canonical money rounding rule for quotes/invoices: every total is rounded
 * to cents (2 decimals) at computation time so float noise (e.g.
 * 3 * 0.1 = 0.30000000000000004) is never persisted to subtotal/total columns.
 * Consumers display these rounded values; display formatting is the formatter's
 * job (F30) — this is where the value is made exact.
 */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Safely maps the nullable payment_terms column to the PaymentTerms union. */
function mapPaymentTerms(value: string | null | undefined): PaymentTerms | undefined {
  if (!value) return undefined;
  if (!PAYMENT_TERMS_VALUES.some((t) => t === value)) return undefined;
  return value as PaymentTerms;
}

function mapRowToInvoice(row: DbInvoice, items: DbInvoiceItem[] = []): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    title: row.title ?? undefined,
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
    paymentTerms: mapPaymentTerms(row.payment_terms),
    companyName: row.company_name ?? undefined,
    companyAddress: row.company_address ?? undefined,
    companyEmail: row.company_email ?? undefined,
    companyPhone: row.company_phone ?? undefined,
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

/**
 * Sequential per-year invoice numbers: INV-<year>-0001, -0002, …
 * Queries the max sequence for the current year and increments it. The unique
 * index on lower(invoice_number) is the backstop — concurrent creates that
 * race here are retried in create() on 23505.
 */
async function getNextInvoiceNumber(): Promise<string> {
  const supabase = await getSharedClient();
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`);
  if (error) throw toServiceError(error);
  let maxSeq = 0;
  for (const row of data ?? []) {
    const value = typeof row?.invoice_number === 'string' ? row.invoice_number : '';
    const match = /^INV-\d{4}-(\d{4})$/.exec(value);
    if (match) {
      const seq = Number(match[1]);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

function itemsEqual(a: InvoiceLineInput[], b: InvoiceLineInput[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((ai, idx) => {
    const bi = b[idx];
    return (
      bi !== undefined &&
      ai.description === bi.description &&
      ai.quantity === bi.quantity &&
      ai.unitPrice === bi.unitPrice
    );
  });
}

/**
 * Computes invoice totals. Every money value (per-item total, subtotal,
 * discount, tax, total) is rounded to cents; totals are clamped at zero so an
 * over-discount never produces a negative billing amount. Empty items yield
 * subtotal 0 / tax 0 / total 0 — never NaN. Invalid inputs throw typed
 * ServiceErrors BEFORE any destructive write can run.
 */
function computeTotals(items: InvoiceLineInput[], discount = 0, taxRate = 0) {
  for (const item of items) {
    if (!Number.isFinite(item.quantity)) {
      throw new ServiceError(`Invalid quantity for item: ${item.description}`, 'INVALID_QUANTITY');
    }
    if (item.quantity < 0) {
      throw new ServiceError(`Negative quantity not allowed: ${item.description}`, 'INVALID_QUANTITY');
    }
    if (!Number.isFinite(item.unitPrice)) {
      throw new ServiceError(`Invalid unit price for item: ${item.description}`, 'INVALID_PRICE');
    }
    if (item.unitPrice < 0) {
      throw new ServiceError(`Negative unit price not allowed: ${item.description}`, 'INVALID_PRICE');
    }
  }
  if (!Number.isFinite(discount) || discount < 0) {
    throw new ServiceError(`Invalid discount: ${discount}`, 'INVALID_DISCOUNT');
  }
  if (!Number.isFinite(taxRate) || taxRate < 0) {
    throw new ServiceError(`Invalid tax rate: ${taxRate}`, 'INVALID_TAX_RATE');
  }
  const itemTotals = items.map((i) => ({
    ...i,
    total: roundCents(i.quantity * i.unitPrice),
  }));
  const subtotal = roundCents(itemTotals.reduce((sum, i) => sum + i.total, 0));
  const discountRounded = roundCents(discount);
  const afterDiscount = roundCents(Math.max(0, subtotal - discountRounded));
  const tax = roundCents(afterDiscount * taxRate);
  const total = roundCents(afterDiscount + tax);
  return { itemTotals, subtotal, discount: discountRounded, tax, total };
}

/**
 * Failure-safe restore: re-inserts the previous line items after a failed
 * item replacement, so a failed insert or header update never leaves an
 * invoice with zero items / stale totals (no transactions in mock/PostgREST).
 */
async function restoreInvoiceItems(
  supabase: SharedSupabaseClient,
  invoiceId: string,
  items: Invoice['items'],
): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase.from('invoice_items').insert(
    items.map((item, idx) => ({
      invoice_id: invoiceId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
      sort_order: item.sortOrder,
    })),
  );
  if (error) throw toServiceError(error);
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
      return (data ?? []).map((row: InvoiceWithItemsRow) => mapRowToInvoice(row, row.invoice_items ?? []));
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
      if (!data) return undefined;
      const row = data as InvoiceWithItemsRow;
      return mapRowToInvoice(row, row.invoice_items ?? []);
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
      if (!data) return undefined;
      const row = data as InvoiceWithItemsRow;
      return mapRowToInvoice(row, row.invoice_items ?? []);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async create(data: InvoiceFormData): Promise<Invoice> {
    try {
      const supabase = await getSharedClient();
      const { itemTotals, subtotal, discount, tax, total } = computeTotals(
        data.items,
        data.discount ?? 0,
        data.taxRate ?? 0,
      );

      const { data: session } = await supabase.auth.getSession();
      const createdBy = session?.session?.user?.id ?? USERS[0]?.id ?? 'system';

      // invoice_number is ALWAYS server-generated — caller-supplied values
      // are ignored (the UI may preview a number, but the service owns it).
      const basePayload: InvoiceInsert = {
        quote_id: data.quoteId || null,
        deal_id: data.dealId || null,
        lead_id: data.leadId || null,
        contact_id: data.contactId || null,
        company_id: data.companyId || null,
        title: data.title ?? '',
        status: data.status || 'draft',
        subtotal,
        discount,
        tax_rate: data.taxRate ?? 0,
        tax,
        total,
        notes: data.notes || '',
        due_date: data.dueDate || null,
        payment_terms: data.paymentTerms || null,
        company_name: data.companyName || null,
        company_address: data.companyAddress || null,
        company_email: data.companyEmail || null,
        company_phone: data.companyPhone || null,
        created_by: createdBy,
      };

      // Sequential number + retry on unique violation (23505): two concurrent
      // creates can compute the same max+1; the loser retries with a fresh
      // number instead of failing the whole create.
      let inserted: { id: unknown } | null = null;
      let lastNumberError: { code?: string; message: string } | null = null;
      for (let attempt = 0; attempt < INVOICE_NUMBER_MAX_ATTEMPTS; attempt++) {
        const invoiceNumber = await getNextInvoiceNumber();
        const { data: row, error } = await supabase
          .from('invoices')
          .insert({ ...basePayload, invoice_number: invoiceNumber })
          .select()
          .single();
        if (error) {
          if (error.code === '23505') {
            lastNumberError = error;
            continue;
          }
          throw toServiceError(error);
        }
        inserted = row;
        break;
      }
      if (!inserted) {
        throw new ServiceError(
          `Could not allocate a unique invoice number after ${INVOICE_NUMBER_MAX_ATTEMPTS} attempts`,
          lastNumberError?.code ?? 'INVOICE_NUMBER_EXHAUSTED',
        );
      }
      const invoiceId = typeof inserted.id === 'string' && inserted.id ? inserted.id : '';
      if (!invoiceId) throw new ServiceError('Invoice insert returned no id', 'INSERT_INCOMPLETE');

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
        if (itemsError) {
          // Two-step create: a failed item insert must not leave an orphan
          // invoice header with zero items — remove it, then surface the error.
          await supabase.from('invoices').delete().eq('id', invoiceId);
          throw toServiceError(itemsError);
        }
      }

      const invoice = await this.getById(invoiceId);
      if (!invoice) throw new ServiceError('Invoice created but could not be loaded', 'CREATE_INCOMPLETE');
      return invoice;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async update(id: string, data: Partial<InvoiceFormData>): Promise<Invoice | undefined> {
    try {
      const supabase = await getSharedClient();
      const existing = await this.getById(id);
      if (!existing) return undefined;

      const effectiveItems: InvoiceLineInput[] =
        data.items !== undefined
          ? data.items
          : existing.items.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            }));
      const itemsChanged = data.items !== undefined && !itemsEqual(existing.items, data.items);

      // Compute rounded totals up-front — validation runs BEFORE any
      // destructive delete, so invalid input can never zero out the items.
      const { itemTotals, subtotal, discount, tax, total } = computeTotals(
        effectiveItems,
        data.discount ?? existing.discount,
        data.taxRate ?? existing.taxRate,
      );

      // ── Item replacement (failure-safe: delete checked, insert restored) ──
      if (itemsChanged) {
        const { error: delErr } = await supabase.from('invoice_items').delete().eq('invoice_id', id);
        if (delErr) throw toServiceError(delErr);
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
          if (itemsError) {
            await restoreInvoiceItems(supabase, id, existing.items);
            throw toServiceError(itemsError);
          }
        }
      }

      // ── Header fields: ALWAYS applied (per-field compare against the
      // existing row, so nothing is silently dropped when items are unchanged).
      // invoice_number is NEVER caller-supplied on update — preserved as-is.
      const updateData: Partial<InvoiceUpdate> = {};
      if (data.status !== undefined && data.status !== existing.status) {
        updateData.status = data.status;
        if (data.status === 'paid') updateData.paid_at = new Date().toISOString();
        if (data.status === 'draft' || data.status === 'cancelled') updateData.paid_at = null;
      }
      if (data.title !== undefined && data.title !== (existing.title ?? '')) updateData.title = data.title;
      if (data.notes !== undefined && data.notes !== existing.notes) updateData.notes = data.notes;
      if (data.dueDate !== undefined && (data.dueDate || null) !== (existing.dueDate ?? null)) {
        updateData.due_date = data.dueDate || null;
      }
      if (data.paymentTerms !== undefined && (data.paymentTerms || null) !== (existing.paymentTerms ?? null)) {
        updateData.payment_terms = data.paymentTerms || null;
      }
      if (data.companyName !== undefined && data.companyName !== (existing.companyName ?? '')) {
        updateData.company_name = data.companyName || null;
      }
      if (data.companyAddress !== undefined && data.companyAddress !== (existing.companyAddress ?? '')) {
        updateData.company_address = data.companyAddress || null;
      }
      if (data.companyEmail !== undefined && data.companyEmail !== (existing.companyEmail ?? '')) {
        updateData.company_email = data.companyEmail || null;
      }
      if (data.companyPhone !== undefined && data.companyPhone !== (existing.companyPhone ?? '')) {
        updateData.company_phone = data.companyPhone || null;
      }

      // Totals persist AFTER item replacement succeeded (or from existing
      // items when only the discount / tax rate changed).
      const moneyChanged =
        itemsChanged ||
        (data.discount !== undefined && data.discount !== existing.discount) ||
        (data.taxRate !== undefined && data.taxRate !== existing.taxRate);
      if (moneyChanged) {
        updateData.subtotal = subtotal;
        updateData.discount = discount;
        updateData.tax_rate = data.taxRate ?? existing.taxRate;
        updateData.tax = tax;
        updateData.total = total;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateErr } = await supabase.from('invoices').update(updateData).eq('id', id);
        if (updateErr) {
          if (itemsChanged) await restoreInvoiceItems(supabase, id, existing.items);
          throw toServiceError(updateErr);
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
      // Explicitly remove line items first — safe in both real (FK CASCADE)
      // and mock (no FK enforcement) modes. A failure here aborts the delete
      // so orphaned items are never left behind silently.
      const { error: itemsErr } = await supabase.from('invoice_items').delete().eq('invoice_id', id);
      if (itemsErr) throw toServiceError(itemsErr);
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
      const existing = await this.getById(id);
      if (!existing) return undefined;

      const updateData: Partial<InvoiceUpdate> = { status };
      if (status === 'paid') updateData.paid_at = new Date().toISOString();
      if (status === 'draft' || status === 'cancelled') updateData.paid_at = null;

      const { error } = await supabase.from('invoices').update(updateData).eq('id', id);
      if (error) throw toServiceError(error);

      // Re-fetch WITH line items — the detail view must never see an empty
      // items list after a status change.
      return this.getById(id);
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
