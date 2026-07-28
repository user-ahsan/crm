/**
 * ─── Campaign Scheduler Service ──────────────────────────────────────
 *
 * Campaign execution engine that activates email sequences, processes
 * pending scheduled sends, and reports delivery statistics. Designed to
 * be triggered by an external scheduler (Vercel Cron, GitHub Action, etc.)
 * via a simple API endpoint — no job queue library needed.
 *
 * Flow:
 *   1. activateSequence()  — marks sequence active, queues recipient rows
 *   2. processPendingSends() — cron-triggered, sends due emails, updates status
 *   3. getSequenceStats()   — delivery summary for a sequence
 * ─────────────────────────────────────────────────────────────────────
 */

import { getSharedClient } from '@/lib/supabase/client';
import { campaignService } from './campaign.service';
import { communicationService } from './communication.service';
import { ServiceError, toServiceError } from './supabase.service';
import type { CampaignRecipientInsert, CampaignRecipientUpdate } from '@/types/supabase.types';
import type { CampaignEmail } from '@/types/campaign.types';

// ── Helpers ───────────────────────────────────────────────────────────

const MAX_PROCESSING_ITERATIONS = 100;

/**
 * Adds days to the current UTC date and returns an ISO 8601 string.
 */
function addDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/**
 * Batch looks up email addresses for multiple leads/contacts by ID and type.
 */
async function lookupEntityEmails(
  recipientType: 'lead' | 'contact',
  recipientIds: string[],
): Promise<Map<string, string>> {
  if (recipientIds.length === 0) return new Map();
  try {
    const supabase = await getSharedClient();
    const table = recipientType === 'lead' ? 'leads' : 'contacts';
    const { data, error } = await supabase
      .from(table)
      .select('id, email')
      .in('id', recipientIds);

    if (error || !data) return new Map();
    const result = new Map<string, string>();
    for (const row of data) {
      if (row.email && typeof row.email === 'string') {
        result.set(row.id, row.email);
      }
    }
    return result;
  } catch {
    return new Map();
  }
}

/**
 * Determines whether all campaign_emails in a sequence have been sent
 * (sent or failed) for a given recipient. Used to optionally mark a
 * sequence fully processed.
 */
async function isSequenceCompleteForRecipient(
  sequenceId: string,
  recipientId: string,
): Promise<boolean> {
  try {
    const supabase = getSharedClient();
    const { data, error } = await supabase
      .from('campaign_emails')
      .select('id')
      .eq('sequence_id', sequenceId);

    if (error || !data || data.length === 0) return false;

    const emailIds = data.map((e: { id: string }) => e.id);

    const { data: pending } = await supabase
      .from('campaign_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .in('campaign_email_id', emailIds)
      .in('status', ['pending']);

    // If no pending rows remain for this recipient, the sequence is done
    return (pending ?? []).length === 0;
  } catch {
    return false;
  }
}

// ── Service ───────────────────────────────────────────────────────────

export const campaignScheduler = {
  /**
   * Activates a sequence and queues recipients.
   *
   * Marks the sequence as 'active', then for each lead/contact in the
   * target list, creates a campaign_recipients row per campaign_email
   * in the sequence. Each row's scheduled_send_at is calculated from
   * the email's delayDays relative to now.
   *
   * @param sequenceId - The email_sequence to activate.
   * @param leadIds    - Optional array of lead IDs to include.
   * @param contactIds - Optional array of contact IDs to include.
   * @returns The total number of recipient rows created.
   */
  async activateSequence(
    sequenceId: string,
    leadIds?: string[],
    contactIds?: string[],
  ): Promise<{ total: number }> {
    // 1. Mark sequence as active
    await campaignService.updateSequenceStatus(sequenceId, 'active');

    // 2. Fetch campaign emails ordered by sort_order
    const campaignEmails: CampaignEmail[] = await campaignService.getCampaignEmails(
      sequenceId,
    );
    if (campaignEmails.length === 0) {
      return { total: 0 };
    }

    // 2.5 Dedup check — prevent double activation (TOCTOU mitigated by DB unique constraint)
    const supabase = getSharedClient();
    const { data: existing } = await supabase
      .from('campaign_recipients')
      .select('id')
      .eq('sequence_id', sequenceId)
      .limit(1);
    if (existing && existing.length > 0) {
      throw new ServiceError('Sequence already activated', 'SEQUENCE_ALREADY_ACTIVATED');
    }

    // 3. Batch lookup recipient emails — replaces N+1 sequential lookups
    type RecipientEntry = { type: 'lead' | 'contact'; id: string; email: string };
    const recipients: RecipientEntry[] = [];

    if (leadIds && leadIds.length > 0) {
      const emailMap = await lookupEntityEmails('lead', leadIds);
      for (const lid of leadIds) {
        const email = emailMap.get(lid);
        if (email) recipients.push({ type: 'lead', id: lid, email });
      }
    }

    if (contactIds && contactIds.length > 0) {
      const emailMap = await lookupEntityEmails('contact', contactIds);
      for (const cid of contactIds) {
        const email = emailMap.get(cid);
        if (email) recipients.push({ type: 'contact', id: cid, email });
      }
    }

    if (recipients.length === 0) {
      return { total: 0 };
    }

    // 4. Create campaign_recipients rows
    const rows: CampaignRecipientInsert[] = [];

    for (const recipient of recipients) {
      for (const email of campaignEmails) {
        rows.push({
          sequence_id: sequenceId,
          campaign_email_id: email.id,
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          recipient_email: recipient.email,
          status: 'pending',
          scheduled_send_at: addDays(email.delayDays),
        });
      }
    }

    // Insert in batches of 100 to avoid payload limits
    let totalInserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from('campaign_recipients').insert(batch);
      if (error) {
        throw toServiceError(error);
      }
      totalInserted += batch.length;
    }

    return { total: totalInserted };
  },

  /**
   * Processes all pending scheduled sends.
   *
   * Finds every campaign_recipients row where status='pending' and
   * scheduled_send_at <= now(), groups them by campaign_email_id,
   * sends each group via communicationService.sendBatchEmails(),
   * then updates each row to 'sent' or 'failed'.
   *
   * Called by an external scheduler (Vercel Cron, GitHub Action, etc.).
   *
   * @returns Counts of successfully sent and failed deliveries.
   */
  async processPendingSends(): Promise<{ sent: number; failed: number }> {
    const supabase = getSharedClient();
    let batchSent = 0;
    let batchFailed = 0;
    const affectedSequenceIds = new Set<string>();
    let iterations = 0;

    // Atomic claim + pagination loop with max iteration guard
    while (iterations < MAX_PROCESSING_ITERATIONS) {
      iterations++;

      // Claim batch: atomically update 'pending' -> 'processing' and return rows
      // JOINs with email_sequences to exclude paused sequences
      const { data: claimed, error: claimError } = await supabase
        .from('campaign_recipients')
        .update({ status: 'processing' })
        .eq('status', 'pending')
        .lte('scheduled_send_at', new Date().toISOString())
        .not('campaign_email_id', 'is', null)
        .select(`
          id,
          campaign_email_id,
          recipient_email,
          recipient_type,
          recipient_id,
          sequence_id,
          campaign_email:campaign_email_id (
            subject,
            body
          ),
          sequence:sequence_id!inner (
            status
          )
        `)
        .in('sequence.status', ['active'])
        .limit(500);

      if (claimError) {
        throw toServiceError(claimError);
      }

      if (!claimed || claimed.length === 0) break;

      // Group by campaign_email_id for batch sending
      type ClaimedRow = {
        id: string;
        campaign_email_id: string | null;
        recipient_email: string;
        recipient_type: string;
        recipient_id: string;
        sequence_id: string;
        campaign_email: { subject: string; body: string } | null;
        sequence: { status: string };
      };

      const groups = new Map<
        string,
        { subject: string; body: string; rows: ClaimedRow[] }
      >();

      function isClaimedRowArray(data: unknown): data is ClaimedRow[] {
        return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'id' in data[0];
      }
      if (!isClaimedRowArray(claimed)) break;
      const claimedRows = claimed as ClaimedRow[];

      for (const row of claimedRows) {
        const emailId = row.campaign_email_id;
        if (!emailId || !row.campaign_email) continue;

        if (!groups.has(emailId)) {
          groups.set(emailId, {
            subject: row.campaign_email.subject,
            body: row.campaign_email.body,
            rows: [],
          });
        }
        groups.get(emailId)!.rows.push(row);
      }

      // Process each group sequentially
      let sentCount = 0;
      let failedCount = 0;

      for (const [, group] of groups) {
        const batchPayload = group.rows.map((r) => ({
          toAddress: r.recipient_email,
          subject: group.subject,
          body: group.body,
          relatedToType: r.recipient_type,
          relatedToId: r.recipient_id,
        }));

        const results = await communicationService.sendBatchEmails(batchPayload);

        for (let i = 0; i < results.length; i++) {
          const row = group.rows[i];
          const result = results[i];
          const update: CampaignRecipientUpdate = {
            status: result.success ? 'sent' : 'failed',
            sent_at: result.success ? new Date().toISOString() : null,
            error_message: result.success ? null : (result.error ?? null),
            provider_message_id: result.success ? (result.messageId ?? null) : null,
          };

          const { error: updateError } = await supabase
            .from('campaign_recipients')
            .update(update)
            .eq('id', row.id);

          if (updateError) {
            console.error(
              `[campaign-scheduler] Failed to update recipient ${row.id}: ${updateError.message}`,
            );
          }

          if (result.success) {
            sentCount++;
          } else {
            failedCount++;
          }

          affectedSequenceIds.add(row.sequence_id);
        }
      }

      batchSent += sentCount;
      batchFailed += failedCount;
    }

    if (iterations >= MAX_PROCESSING_ITERATIONS) {
      console.warn(`processPendingSends reached max iterations (${MAX_PROCESSING_ITERATIONS}) — may be infinite loop`);
    }

    // Mark sequences as completed if no pending/processing recipients remain
    for (const seqId of affectedSequenceIds) {
      const { count } = await supabase
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('sequence_id', seqId)
        .in('status', ['pending', 'processing']);

      if (count === 0) {
        await supabase
          .from('email_sequences')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', seqId);
      }
    }

    return { sent: batchSent, failed: batchFailed };
  },

  /**
   * Returns delivery statistics for a sequence.
   *
   * Counts all campaign_recipients rows across every campaign_email
   * in the sequence, grouped by status.
   *
   * @param sequenceId - The email_sequence to query.
   */
  async getSequenceStats(
    sequenceId: string,
  ): Promise<{ total: number; sent: number; failed: number; pending: number }> {
    try {
      const supabase = getSharedClient();
      const [sentRes, failedRes, pendingRes] = await Promise.all([
        supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('sequence_id', sequenceId).eq('status', 'sent'),
        supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('sequence_id', sequenceId).eq('status', 'failed'),
        supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('sequence_id', sequenceId).eq('status', 'pending'),
      ]);
      const total = (sentRes.count ?? 0) + (failedRes.count ?? 0) + (pendingRes.count ?? 0);
      return { total, sent: sentRes.count ?? 0, failed: failedRes.count ?? 0, pending: pendingRes.count ?? 0 };
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Pauses a sequence by setting its status to 'paused'.
   */
  async pauseSequence(sequenceId: string): Promise<void> {
    await campaignService.updateSequenceStatus(sequenceId, 'paused');
  },
};
