'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IconEdit, IconArrowLeft } from '@tabler/icons-react';
import type { Lead } from '@/types/lead.types';
import { useLeads } from '@/hooks/useLeads';
import { LeadDetail } from '@/components/leads/LeadDetail';
import { LeadCreateForm } from '@/components/leads/LeadCreateForm';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { getById: getLeadById } = useLeads();

  const loadLead = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const found = await getLeadById(leadId);
      if (found) {
        setLead(found);
      } else {
        setError('Lead not found');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  }, [leadId, getLeadById]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await leadService.getById(leadId);
        if (cancelled) return;
        if (data) {
          setLead(data);
        } else {
          setError('Lead not found');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load lead');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  const handleBack = useCallback(() => {
    router.push('/leads');
  }, [router]);

  const handleEdit = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleSuccess = useCallback(
    (_updatedLead: Lead) => {
      loadLead();
    },
    [loadLead],
  );

  // --- Loading State ---
  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" disabled className="mb-2">
          <IconArrowLeft className="mr-2 size-4" />
          Back to leads
        </Button>
        <LoadingSkeleton type="detail" />
      </div>
    );
  }

  // --- Not Found State ---
  if (error === 'Lead not found' || (!loading && !lead && error)) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={handleBack} className="mb-2">
          <IconArrowLeft className="mr-2 size-4" />
          Back to leads
        </Button>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="mb-1 text-lg font-semibold">Lead not found</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            The lead you are looking for does not exist or has been deleted.
          </p>
          <Button variant="outline" onClick={handleBack}>
            Go to Leads
          </Button>
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={handleBack} className="mb-2">
          <IconArrowLeft className="mr-2 size-4" />
          Back to leads
        </Button>
        <ErrorState message={error} onRetry={loadLead} />
      </div>
    );
  }

  // Safety check - should not happen
  if (!lead) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleBack}>
          <IconArrowLeft className="mr-2 size-4" />
          Back to leads
        </Button>
        <Button onClick={handleEdit}>
          <IconEdit className="mr-2 size-4" />
          Edit Lead
        </Button>
      </div>

      {/* Lead Detail Component */}
      <LeadDetail leadId={leadId} onBack={handleBack} />

      {/* Edit Dialog */}
      <LeadCreateForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
        editLead={lead}
      />
    </div>
  );
}
