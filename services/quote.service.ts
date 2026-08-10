import { getSharedClient } from '@/lib/supabase/client';
import type { SharedSupabaseClient } from '@/lib/supabase/client';
import type { Quote, QuoteFormData, QuoteStatus } from '@/types/quote.types';
import type { DbQuote, DbQuoteItem, QuoteInsert, QuoteUpdate } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';
import { triggerWebhook } from './webhook.service';
import { automationService } from './automation.service';
import { USERS } from '@/data/mock-users';

type QuoteWithItemsRow = DbQuote & { quote_items?: DbQuoteItem[] };

interface QuoteLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * FEATURES.md §14 quote status workflow. `accepted` is terminal; a rejected
 * quote can be reopened to draft. Same-status updates are always allowed
 * (no-ops) so edit dialogs that resend the current status keep working.
 */
const ALLOWED_QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected'],
  accepted: [],
  rejected: ['draft'],
};

function assertValidQuoteTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (from === to) return;
  const allowed = ALLOWED_QUOTE_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new ServiceError(
      `Invalid quote status transition: ${from} -> ${to}. Allowed from ${from}: ${allowed.length > 0 ? allowed.join(', ') : 'none'}.`,
      'INVALID_STATUS_TRANSITION',
    );
  }
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

function mapRowToQuote(row: DbQuote, items: DbQuoteItem[] = []): Quote {
  return {
    id: row.id,
    title: row.title,
    dealId: row.deal_id ?? undefined,
    leadId: row.lead_id ?? undefined,
    contactId: row.contact_id ?? undefined,
    companyId: row.company_id ?? undefined,
    status: row.status as QuoteStatus,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total),
    notes: row.notes,
    validUntil: row.valid_until ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map(mapRowToQuoteItem),
  };
}

function mapRowToQuoteItem(row: DbQuoteItem) {
  return {
    id: row.id,
    quoteId: row.quote_id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
    sortOrder: row.sort_order,
  };
}

function mapFormToQuoteDb(data: Partial<QuoteFormData>): Partial<QuoteInsert> {
  const db: Partial<QuoteInsert> = {};
  if (data.title !== undefined) db.title = data.title;
  if (data.dealId !== undefined) db.deal_id = data.dealId || null;
  if (data.leadId !== undefined) db.lead_id = data.leadId || null;
  if (data.contactId !== undefined) db.contact_id = data.contactId || null;
  if (data.companyId !== undefined) db.company_id = data.companyId || null;
  if (data.status !== undefined) db.status = data.status;
  if (data.discount !== undefined) db.discount = data.discount;
  if (data.notes !== undefined) db.notes = data.notes || '';
  if (data.validUntil !== undefined) db.valid_until = data.validUntil || null;
  return db;
}

function itemsEqual(a: QuoteLineInput[], b: QuoteLineInput[]): boolean {
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
 * Computes quote totals. Every money value (per-item total, subtotal,
 * discount, total) is rounded to cents; totals are clamped at zero so an
 * over-discount never produces a negative billing amount. Empty items yield
 * subtotal 0 / total 0 — never NaN. Invalid inputs throw typed ServiceErrors
 * BEFORE any destructive write can run.
 */
function computeTotals(items: QuoteLineInput[], discount = 0) {
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
  const itemTotals = items.map((i) => ({
    ...i,
    total: roundCents(i.quantity * i.unitPrice),
  }));
  const subtotal = roundCents(itemTotals.reduce((sum, i) => sum + i.total, 0));
  const discountRounded = roundCents(discount);
  const total = roundCents(Math.max(0, subtotal - discountRounded));
  return { itemTotals, subtotal, discount: discountRounded, total };
}

/**
 * Failure-safe restore: re-inserts the previous line items after a failed
 * item replacement, so a failed insert or header update never leaves a quote
 * with zero items / stale totals (no transactions available in mock/PostgREST).
 */
async function restoreQuoteItems(
  supabase: SharedSupabaseClient,
  quoteId: string,
  items: Quote['items'],
): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase.from('quote_items').insert(
    items.map((item, idx) => ({
      quote_id: quoteId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
      sort_order: item.sortOrder,
    })),
  );
  if (error) throw toServiceError(error);
}

export const quoteService = {
  async getAll(page = 1, pageSize = 50): Promise<Quote[]> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw toServiceError(error);
      return (data ?? []).map((row: QuoteWithItemsRow) => mapRowToQuote(row, row.quote_items ?? []));
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async getById(id: string): Promise<Quote | undefined> {
    try {
      const supabase = await getSharedClient();
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      if (!data) return undefined;
      const row = data as QuoteWithItemsRow;
      return mapRowToQuote(row, row.quote_items ?? []);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async create(data: QuoteFormData): Promise<Quote> {
    try {
      const supabase = await getSharedClient();
      const { itemTotals, subtotal, discount, total } = computeTotals(data.items, data.discount ?? 0);

      const { data: session } = await supabase.auth.getSession();
      const createdBy = session?.session?.user?.id ?? USERS[0]?.id ?? 'system';

      const { data: inserted, error } = await supabase
        .from('quotes')
        .insert({
          ...mapFormToQuoteDb(data),
          subtotal,
          discount,
          total,
          created_by: createdBy,
        })
        .select()
        .single();
      if (error) throw toServiceError(error);
      if (!inserted) throw new ServiceError('Quote insert returned no row', 'INSERT_INCOMPLETE');
      const quoteId = typeof inserted.id === 'string' && inserted.id ? inserted.id : '';
      if (!quoteId) throw new ServiceError('Quote insert returned no id', 'INSERT_INCOMPLETE');

      if (itemTotals.length > 0) {
        const { error: itemsError } = await supabase.from('quote_items').insert(
          itemTotals.map((item, idx) => ({
            quote_id: quoteId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total: item.total,
            sort_order: idx,
          })),
        );
        if (itemsError) {
          // Two-step create: a failed item insert must not leave an orphan
          // quote header with zero items — remove it, then surface the error.
          await supabase.from('quotes').delete().eq('id', quoteId);
          throw toServiceError(itemsError);
        }
      }

      const quote = await this.getById(quoteId);
      if (!quote) throw new ServiceError('Quote created but could not be loaded', 'CREATE_INCOMPLETE');

      triggerWebhook('quote.created', {
        id: quote.id,
        title: quote.title,
        status: quote.status,
        subtotal: quote.subtotal,
        discount: quote.discount,
        total: quote.total,
        createdBy: quote.createdBy,
      });
      await automationService.evaluate('quote.created', {
        entityType: 'quote',
        entityId: quote.id,
        title: quote.title,
        status: quote.status,
        total: quote.total,
      });

      return quote;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async update(id: string, data: Partial<QuoteFormData>): Promise<Quote | undefined> {
    try {
      const supabase = await getSharedClient();
      const existing = await this.getById(id);
      if (!existing) return undefined;

      // Enforce the FEATURES §14 workflow on every update path (edit dialog
      // included) — the dialog can no longer jump draft -> accepted etc.
      if (data.status !== undefined && data.status !== existing.status) {
        assertValidQuoteTransition(existing.status, data.status);
      }

      const effectiveItems: QuoteLineInput[] =
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
      const { itemTotals, subtotal, discount, total } = computeTotals(
        effectiveItems,
        data.discount ?? existing.discount,
      );

      // ── Item replacement (failure-safe: delete checked, insert restored) ──
      if (itemsChanged) {
        const { error: delErr } = await supabase.from('quote_items').delete().eq('quote_id', id);
        if (delErr) throw toServiceError(delErr);
        if (itemTotals.length > 0) {
          const { error: itemsError } = await supabase.from('quote_items').insert(
            itemTotals.map((item, idx) => ({
              quote_id: id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total: item.total,
              sort_order: idx,
            })),
          );
          if (itemsError) {
            await restoreQuoteItems(supabase, id, existing.items);
            throw toServiceError(itemsError);
          }
        }
      }

      // ── Header + totals: applied AFTER item replacement succeeded ──
      const dbData: Partial<QuoteUpdate> = { ...mapFormToQuoteDb(data) };
      const totalsChanged = itemsChanged || (data.discount !== undefined && data.discount !== existing.discount);
      if (totalsChanged) {
        dbData.subtotal = subtotal;
        dbData.discount = discount;
        dbData.total = total;
      }

      if (Object.keys(dbData).length > 0) {
        const { error: updateError } = await supabase.from('quotes').update(dbData).eq('id', id);
        if (updateError) {
          if (itemsChanged) await restoreQuoteItems(supabase, id, existing.items);
          throw toServiceError(updateError);
        }
      }

      const quote = await this.getById(id);
      if (!quote) throw new ServiceError('Quote updated but could not be loaded', 'UPDATE_INCOMPLETE');

      triggerWebhook('quote.updated', {
        id: quote.id,
        title: quote.title,
        status: quote.status,
        subtotal: quote.subtotal,
        discount: quote.discount,
        total: quote.total,
      });
      await automationService.evaluate('quote.updated', {
        entityType: 'quote',
        entityId: quote.id,
        title: quote.title,
        status: quote.status,
        total: quote.total,
      });

      return quote;
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
      const { error: itemsErr } = await supabase.from('quote_items').delete().eq('quote_id', id);
      if (itemsErr) throw toServiceError(itemsErr);
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (error) throw toServiceError(error);
      return true;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async updateStatus(id: string, status: QuoteStatus): Promise<Quote | undefined> {
    try {
      const supabase = await getSharedClient();
      const existing = await this.getById(id);
      if (!existing) return undefined;
      assertValidQuoteTransition(existing.status, status);

      const { error } = await supabase.from('quotes').update({ status }).eq('id', id);
      if (error) throw toServiceError(error);

      // Re-fetch WITH line items — the detail view must never see an empty
      // items list after a status change.
      const updated = await this.getById(id);
      if (!updated) return undefined;

      triggerWebhook('quote.updated', {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        subtotal: updated.subtotal,
        discount: updated.discount,
        total: updated.total,
      });
      await automationService.evaluate('quote.updated', {
        entityType: 'quote',
        entityId: updated.id,
        title: updated.title,
        status: updated.status,
        total: updated.total,
      });

      return updated;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
