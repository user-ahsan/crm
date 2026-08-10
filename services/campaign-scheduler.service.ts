/**
 * ─── Campaign Scheduler Service ──────────────────────────────────────
 *
 * Campaign execution engine that activates email sequences, processes
 * pending scheduled sends, and reports delivery statistics. Designed to
 * be triggered by an external scheduler (Vercel Cron, GitHub Action, etc.)
 * via a simple API endpoint — no job queue library needed.
 *
 * Flow:
 *   1. activateSequence()  — validates draft-only, queues recipient rows,
 *                            then marks sequence active (the ONLY path to
 *                            'active' from draft)
 *   2. resumeSequence()    — the ONLY path from 'paused' back to 'active'
 *                            (recipients already queued — no re-queueing)
 *   3. pauseSequence()     — active → paused (delegates to the campaign
 *                            service's transition enforcement)
 *   4. processPendingSends() — cron-triggered, sends due emails, updates
 *                            status, auto-completes exhausted sequences
 *   5. getSequenceStats()   — delivery summary for a sequence, read from
 *                            real campaign_recipients rows
 *
 * Scheduler-specific rules:
 *   - Only sequences currently 'active' are eligible for delivery; paused
 *     and completed sequences never have rows claimed (two-step claim:
 *     SELECT eligible rows joined with sequence status, then UPDATE only
 *     their ids — a joined filter inside the UPDATE is unreliable in
 *     PostgREST and unsupported by the mock client).
 *   - Rows stranded in 'processing' longer than STALE_PROCESSING_MS
 *     (crashed run) are reclaimed to 'pending' at the start of each run.
 *   - Send is sequential via communicationService.sendBatchEmails (mock
 *     honesty — no parallel blast; note the throughput ceiling).
 * ─────────────────────────────────────────────────────────────────────
 */

import { getSharedClient } from '@/lib/supabase/client';
import { automationService } from './automation.service';
import { triggerWebhook } from './webhook.service';
import { campaignService } from './campaign.service';
import { communicationService } from './communication.service';
import { ServiceError, toServiceError } from './supabase.service';
import type { CampaignRecipientInsert, CampaignRecipientUpdate } from '@/types/supabase.types';
import type { CampaignEmail, CampaignStatus, EmailSequence } from '@/types/campaign.types';

// ── Helpers ───────────────────────────────────────────────────────────

const MAX_PROCESSING_ITERATIONS = 100;
/** Rows left in `processing` longer than this are assumed orphaned (crashed run) and reclaimed. */
const STALE_PROCESSING_MS = 15 * 60 * 1000;
/** Max rows claimed per processPendingSends iteration. */
const CLAIM_BATCH_SIZE = 500;
/** Max recipient rows inserted per activation batch (payload guard). */
const INSERT_BATCH_SIZE = 100;

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
    const supabase = getSharedClient();
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
 * Local extension of the campaign_recipients update contract. The
 * `claimed_at` column is added by
 * supabase/migrations/20260731_campaign_recipients_claimed_at.sql; the
 * regenerated Database types do not yet carry it, so the scheduler keeps
 * a local type instead of an unsafe cast.
 */
interface CampaignRecipientClaimUpdate extends CampaignRecipientUpdate {
  claimed_at?: string | null;
}

/**
 * Sets an email_sequence's status directly. Used ONLY by the scheduler's
 * lifecycle paths (activate / resume / auto-complete). The public
 * campaignService.updateSequenceStatus deliberately rejects 'active', so
 * this internal writer is the single place the scheduler flips status.
 */
async function setSequenceStatusRaw(sequenceId: string, status: CampaignStatus): Promise<void> {
  const supabase = getSharedClient();
  const { error } = await supabase
    .from('email_sequences')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', sequenceId);
  if (error) throw toServiceError(error);
}

// ── Service ───────────────────────────────────────────────────────────

export const campaignScheduler = {
  /**
   * Activates a draft sequence and queues recipients.
   *
   * Validates: the sequence exists and is in draft status, it has at least
   * one campaign email, no recipients have already been queued, and at
   * least one recipient email resolves. Recipient rows are created per
   * (lead/contact, campaign email) with scheduled_send_at derived from the
   * email's delayDays. Only after every row is inserted does the sequence
   * flip to 'active' — a partial failure rolls back this run's inserts so
   * a draft can never be left half-queued or 'active' with zero recipients.
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
    const supabase = getSharedClient();

    // 1. Validate — only drafts can be activated fresh; activation queues rows.
    const sequence = await campaignService.getSequence(sequenceId);
    if (!sequence) throw new ServiceError('Sequence not found', 'NOT_FOUND');
    if (sequence.status !== 'draft') {
      throw new ServiceError(
        `Can only activate draft sequences (current status: ${sequence.status}). Paused sequences resume via campaignScheduler.resumeSequence.`,
        'INVALID_TRANSITION',
      );
    }

    // 2. Dedup check — a sequence that already queued recipients cannot be
    //    re-activated (DB unique(sequence_id, recipient_email) is the backstop).
    const { data: existing } = await supabase
      .from('campaign_recipients')
      .select('id')
      .eq('sequence_id', sequenceId)
      .limit(1);
    if (existing && existing.length > 0) {
      throw new ServiceError('Sequence already activated', 'SEQUENCE_ALREADY_ACTIVATED');
    }

    // 3. Emails are the delivery steps — an active sequence with zero emails
    //    can never send or complete, so refuse to activate it.
    const campaignEmails: CampaignEmail[] = await campaignService.getCampaignEmails(sequenceId);
    if (campaignEmails.length === 0) {
      throw new ServiceError('Sequence has no campaign emails — add at least one email before activating', 'INVALID_STATE');
    }

    // 4. Batch lookup recipient emails (replaces N+1 sequential lookups).
    const recipients: Array<{ type: 'lead' | 'contact'; id: string; email: string }> = [];

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

    // 5. An active sequence with zero recipients can never complete — refuse.
    if (recipients.length === 0) {
      throw new ServiceError(
        'No recipients could be queued — none of the provided leads/contacts have an email address',
        'NO_RECIPIENTS',
      );
    }

    // 6. Dedup by recipient email (the mock has no unique constraint; the DB
    //    unique(sequence_id, recipient_email) index is the real backstop).
    const seenEmails = new Set<string>();
    const dedupedRecipients: typeof recipients = [];
    for (const recipient of recipients) {
      const key = recipient.email.toLowerCase();
      if (seenEmails.has(key)) continue;
      seenEmails.add(key);
      dedupedRecipients.push(recipient);
    }

    // 7. Build one recipient row per (recipient, campaign email).
    const rows: CampaignRecipientInsert[] = [];
    for (const recipient of dedupedRecipients) {
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

    // 8. Insert in batches; roll back this run's rows on failure so a partial
    //    activation cannot leave a draft sequence half-queued.
    let totalInserted = 0;
    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
      const { error } = await supabase.from('campaign_recipients').insert(batch);
      if (error) {
        await supabase.from('campaign_recipients').delete().eq('sequence_id', sequenceId);
        throw toServiceError(error);
      }
      totalInserted += batch.length;
    }

    // 9. Only now flip to active — the queue exists, so the scheduler can deliver.
    await setSequenceStatusRaw(sequenceId, 'active');

    // 10. Dispatch lifecycle event (fire-and-forget; evaluate never throws).
    triggerWebhook('campaign.activated', {
      id: sequence.id,
      name: sequence.name,
      status: 'active',
      total: totalInserted,
    });
    await automationService.evaluate('campaign.activated', {
      entityType: 'campaign',
      entityId: sequence.id,
      name: sequence.name,
      status: 'active',
      total: totalInserted,
    });

    return { total: totalInserted };
  },

  /**
   * Processes all pending scheduled sends.
   *
   * 1. Reclaims rows stranded in 'processing' for longer than
   *    STALE_PROCESSING_MS (crashed/aborted run) back to 'pending'.
   * 2. Claims due pending rows belonging ONLY to currently-active
   *    sequences (two-step claim — SELECT eligible ids, then UPDATE those
   *    ids — so paused sequences can never have rows stuck in
   *    'processing').
   * 3. Sends each campaign-email group via
   *    communicationService.sendBatchEmails(), then updates each row to
   *    'sent' or 'failed'.
   * 4. Auto-completes active sequences whose recipients are exhausted.
   *
   * Called by an external scheduler (Vercel Cron, GitHub Action, etc.).
   *
   * @returns Counts of successfully sent and failed deliveries.
   */
  async processPendingSends(): Promise<{ sent: number; failed: number }> {
    const supabase = getSharedClient();
    let batchSent = 0;
    let batchFailed = 0;
    let iterations = 0;

    // 0. Stale reclaim — rows in 'processing' older than the horizon were
    //    claimed by a run that never finished; send them back to 'pending'
    //    so they are retried instead of stuck forever.
    const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
    const reclaimUpdate: CampaignRecipientClaimUpdate = { status: 'pending', claimed_at: null };
    const { error: reclaimError } = await supabase
      .from('campaign_recipients')
      .update(reclaimUpdate)
      .eq('status', 'processing')
      .lt('claimed_at', staleCutoff);
    if (reclaimError) throw toServiceError(reclaimError);

    // Claim + pagination loop with max iteration guard.
    while (iterations < MAX_PROCESSING_ITERATIONS) {
      iterations++;

      // 1. Only sequences currently 'active' are eligible for delivery.
      const { data: activeRows, error: seqError } = await supabase
        .from('email_sequences')
        .select('id')
        .eq('status', 'active');
      if (seqError) throw toServiceError(seqError);
      const activeSequenceIds = (activeRows ?? []).map((row) => row.id);
      if (activeSequenceIds.length === 0) break;

      // 2. Due pending rows belonging to active sequences. The claim is a
      //    two-step SELECT → UPDATE (not a joined UPDATE) so paused
      //    sequences can never have rows moved into 'processing'.
      const { data: dueRows, error: dueError } = await supabase
        .from('campaign_recipients')
        .select('id, campaign_email_id, recipient_email, recipient_type, recipient_id, sequence_id')
        .eq('status', 'pending')
        .lte('scheduled_send_at', new Date().toISOString())
        .not('campaign_email_id', 'is', null)
        .in('sequence_id', activeSequenceIds)
        .limit(CLAIM_BATCH_SIZE);
      if (dueError) throw toServiceError(dueError);
      if (!dueRows || dueRows.length === 0) break;

      // 3. Claim the eligible ids. The status guard keeps a concurrent run
      //    from double-claiming, and .select('id') returns only the rows
      //    this run actually updated — the winner processes, the loser skips.
      const dueIds = dueRows.map((row) => row.id);
      const claimUpdate: CampaignRecipientClaimUpdate = {
        status: 'processing',
        claimed_at: new Date().toISOString(),
      };
      const { data: claimedRows, error: claimError } = await supabase
        .from('campaign_recipients')
        .update(claimUpdate)
        .eq('status', 'pending')
        .in('id', dueIds)
        .select('id');
      if (claimError) throw toServiceError(claimError);
      const claimedIdSet = new Set((claimedRows ?? []).map((row) => row.id));
      const rowsToProcess = dueRows.filter((row) => claimedIdSet.has(row.id));
      if (rowsToProcess.length === 0) break;

      // 4. Load email content for the claimed rows (subject/body per email id).
      const emailIds = [
        ...new Set(
          rowsToProcess
            .map((row) => row.campaign_email_id)
            .filter((id): id is string => id !== null),
        ),
      ];
      const { data: emailRows, error: emailError } = await supabase
        .from('campaign_emails')
        .select('id, subject, body')
        .in('id', emailIds);
      if (emailError) throw toServiceError(emailError);
      const emailById = new Map((emailRows ?? []).map((email) => [email.id, email]));

      // 5. Group by campaign_email_id for batch sending.
      type ProcessRow = {
        id: string;
        campaign_email_id: string | null;
        recipient_email: string;
        recipient_type: string;
        recipient_id: string;
        sequence_id: string;
      };
      const groups = new Map<string, { subject: string; body: string; rows: ProcessRow[] }>();

      for (const row of rowsToProcess) {
        const emailId = row.campaign_email_id;
        if (!emailId) continue; // filtered out by the query — defensive
        const email = emailById.get(emailId);
        if (!email) {
          // Dangling reference (mock mode has no FK cascade): fail the row
          // honestly instead of leaving it claimed/processing forever.
          const failUpdate: CampaignRecipientClaimUpdate = {
            status: 'failed',
            sent_at: null,
            error_message: 'Campaign email no longer exists',
            provider_message_id: null,
            claimed_at: null,
          };
          const { error: failError } = await supabase
            .from('campaign_recipients')
            .update(failUpdate)
            .eq('id', row.id);
          if (failError) {
            console.error(`[campaign-scheduler] Failed to fail recipient ${row.id}: ${failError.message}`);
          }
          batchFailed++;
          continue;
        }
        const group = groups.get(emailId);
        if (group) {
          group.rows.push(row);
        } else {
          groups.set(emailId, { subject: email.subject, body: email.body, rows: [row] });
        }
      }

      // 6. Send each group sequentially (mock honesty — sendBatchEmails
      //    awaits each recipient one at a time; note the throughput ceiling).
      for (const [, group] of groups) {
        const batchPayload = group.rows.map((row) => ({
          toAddress: row.recipient_email,
          subject: group.subject,
          body: group.body,
          relatedToType: row.recipient_type,
          relatedToId: row.recipient_id,
        }));

        const results = await communicationService.sendBatchEmails(batchPayload);

        for (let i = 0; i < results.length; i++) {
          const row = group.rows[i];
          const result = results[i];
          const update: CampaignRecipientClaimUpdate = {
            status: result.success ? 'sent' : 'failed',
            sent_at: result.success ? new Date().toISOString() : null,
            error_message: result.success ? null : (result.error ?? null),
            provider_message_id: result.success ? (result.messageId ?? null) : null,
            claimed_at: null,
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
            batchSent++;
          } else {
            batchFailed++;
          }
        }
      }
    }

    if (iterations >= MAX_PROCESSING_ITERATIONS) {
      console.warn(`processPendingSends reached max iterations (${MAX_PROCESSING_ITERATIONS}) — may be infinite loop`);
    }

    // 7. Auto-complete active sequences whose recipients are exhausted.
    //    Scan ALL active sequences (not just ones touched this run) so a
    //    run that finished a batch but crashed before completing still
    //    completes on the next invocation. Paused/completed sequences are
    //    untouched — completion only ever fires for sequences that were
    //    actively delivering.
    const { data: activeRows, error: seqError } = await supabase
      .from('email_sequences')
      .select('id')
      .eq('status', 'active');
    if (seqError) throw toServiceError(seqError);

    for (const activeSeq of activeRows ?? []) {
      const { count } = await supabase
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('sequence_id', activeSeq.id)
        .in('status', ['pending', 'processing']);

      if (count === 0) {
        await setSequenceStatusRaw(activeSeq.id, 'completed');
        const completedSeq = await campaignService.getSequence(activeSeq.id);
        if (completedSeq) {
          triggerWebhook('campaign.completed', {
            id: completedSeq.id,
            name: completedSeq.name,
            status: 'completed',
          });
          await automationService.evaluate('campaign.completed', {
            entityType: 'campaign',
            entityId: completedSeq.id,
            name: completedSeq.name,
            status: 'completed',
          });
        }
      }
    }

    return { sent: batchSent, failed: batchFailed };
  },

  /**
   * Returns delivery statistics for a sequence, computed from the real
   * campaign_recipients rows (every status in the CHECK constraint:
   * pending / processing / sent / failed / opened).
   *
   * @param sequenceId - The email_sequence to query.
   */
  async getSequenceStats(
    sequenceId: string,
  ): Promise<{ total: number; sent: number; failed: number; pending: number; processing: number; opened: number }> {
    try {
      const supabase = getSharedClient();
      const [sentRes, failedRes, pendingRes, processingRes, openedRes] = await Promise.all([
        supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('sequence_id', sequenceId).eq('status', 'sent'),
        supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('sequence_id', sequenceId).eq('status', 'failed'),
        supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('sequence_id', sequenceId).eq('status', 'pending'),
        supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('sequence_id', sequenceId).eq('status', 'processing'),
        supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('sequence_id', sequenceId).eq('status', 'opened'),
      ]);
      const sent = sentRes.count ?? 0;
      const failed = failedRes.count ?? 0;
      const pending = pendingRes.count ?? 0;
      const processing = processingRes.count ?? 0;
      const opened = openedRes.count ?? 0;
      return { total: sent + failed + pending + processing + opened, sent, failed, pending, processing, opened };
    } catch (e) {
      throw toServiceError(e);
    }
  },

  /**
   * Pauses an active sequence (active → paused). Delegates to the campaign
   * service's transition enforcement, which rejects pausing drafts and
   * completed sequences and is an idempotent no-op for already-paused ones.
   */
  async pauseSequence(sequenceId: string): Promise<void> {
    await campaignService.updateSequenceStatus(sequenceId, 'paused');
  },

  /**
   * Resumes a paused sequence (paused → active). The ONLY path back to
   * 'active' from paused. Recipients are already queued — nothing is
   * re-inserted, so the scheduler can immediately claim due rows again.
   *
   * @param sequenceId - The email_sequence to resume.
   * @returns The updated sequence.
   */
  async resumeSequence(sequenceId: string): Promise<EmailSequence> {
    const sequence = await campaignService.getSequence(sequenceId);
    if (!sequence) throw new ServiceError('Sequence not found', 'NOT_FOUND');
    if (sequence.status !== 'paused') {
      throw new ServiceError(
        `Can only resume a paused sequence (current status: ${sequence.status})`,
        'INVALID_TRANSITION',
      );
    }

    await setSequenceStatusRaw(sequenceId, 'active');

    triggerWebhook('campaign.activated', {
      id: sequence.id,
      name: sequence.name,
      status: 'active',
    });
    await automationService.evaluate('campaign.activated', {
      entityType: 'campaign',
      entityId: sequence.id,
      name: sequence.name,
      status: 'active',
    });

    const updated = await campaignService.getSequence(sequenceId);
    if (!updated) throw new ServiceError('Sequence not found after resume', 'NOT_FOUND');
    return updated;
  },
};
