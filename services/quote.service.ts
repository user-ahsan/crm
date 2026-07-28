import { getSharedClient } from '@/lib/supabase/client';
import type { Quote, QuoteFormData, QuoteStatus } from '@/types/quote.types';
import type { DbQuote, DbQuoteItem, QuoteInsert } from '@/types/supabase.types';
import { ServiceError, toServiceError } from './supabase.service';

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

function computeTotals(items: { description: string; quantity: number; unitPrice: number }[], discount: number = 0) {
  for (const item of items) {
    if (item.quantity < 0) throw new ServiceError(`Negative quantity not allowed: ${item.description}`, 'INVALID_QUANTITY');
    if (item.unitPrice < 0) throw new ServiceError(`Negative unit price not allowed: ${item.description}`, 'INVALID_PRICE');
  }
  const itemTotals = items.map((i) => ({
    ...i,
    total: i.quantity * i.unitPrice,
  }));
  const subtotal = itemTotals.reduce((sum, i) => sum + i.total, 0);
  const total = Math.max(0, subtotal - discount);
  return { itemTotals, subtotal, total };
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
      return (data ?? []).map((row: DbQuote & { quote_items?: DbQuoteItem[] }) =>
        mapRowToQuote(row, row.quote_items ?? []),
      );
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
      return data
        ? mapRowToQuote(data as DbQuote, (data as { quote_items?: DbQuoteItem[] }).quote_items ?? [])
        : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async create(data: QuoteFormData): Promise<Quote> {
    try {
      const supabase = await getSharedClient();
      const { itemTotals, subtotal, total } = computeTotals(data.items, data.discount ?? 0);

      const { data: inserted, error } = await supabase
        .from('quotes')
        .insert({
          ...mapFormToQuoteDb(data),
          subtotal,
          total,
        })
        .select()
        .single();
      if (error) throw toServiceError(error);

      const quoteId = inserted.id;

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
        if (itemsError) throw toServiceError(itemsError);
      }

      const quote = await this.getById(quoteId);
      return quote!;
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async update(id: string, data: Partial<QuoteFormData>): Promise<Quote | undefined> {
    try {
      const supabase = await getSharedClient();

      const existing = await this.getById(id);
      if (!existing) return undefined;

      // Only re-insert items when items actually changed
      if (data.items) {
        const items: { description: string; quantity: number; unitPrice: number }[] =
          data.items ?? existing.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          }));
        const discount = data.discount ?? existing.discount;
        const { itemTotals, subtotal, total } = computeTotals(items, discount);

        const dbData = {
          ...mapFormToQuoteDb(data),
          subtotal,
          total,
        };

        const { error: updateError } = await supabase
          .from('quotes')
          .update(dbData)
          .eq('id', id);
        if (updateError) throw toServiceError(updateError);

        // Delete old items and insert new ones in sequence (simulated transaction)
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
          if (itemsError) throw toServiceError(itemsError);
        }
      } else {
        // Only update header fields
        const dbData = mapFormToQuoteDb(data);
        if (data.discount !== undefined) {
          const { subtotal, total } = computeTotals(
            existing.items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
            data.discount,
          );
          dbData.subtotal = subtotal;
          dbData.total = total;
        }
        const { error: updateError } = await supabase
          .from('quotes')
          .update(dbData)
          .eq('id', id);
        if (updateError) throw toServiceError(updateError);
      }

      return this.getById(id);
    } catch (e) {
      throw toServiceError(e);
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSharedClient();
      // Also delete quote_items
      const { error: itemsErr } = await supabase.from('quote_items').delete().eq('quote_id', id);
      if (itemsErr) console.error(`Delete quote_items error: ${itemsErr.message}`);
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
      const { data, error } = await supabase
        .from('quotes')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw toServiceError(error);
      }
      return data ? mapRowToQuote(data as DbQuote) : undefined;
    } catch (e) {
      throw toServiceError(e);
    }
  },
};
