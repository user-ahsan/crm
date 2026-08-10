'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IconArrowLeft, IconEdit } from '@tabler/icons-react';
import type { Company } from '@/types/company.types';
import { useCompanies } from '@/hooks/useCompanies';
import { CompanyDetail } from '@/components/companies/CompanyDetail';
import { CompanyCreateForm } from '@/components/companies/CompanyCreateForm';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id;
  const companyId = typeof rawId === 'string' ? rawId : '';
  if (!companyId) throw new Error('Invalid company ID');

  const { getById: getCompanyById } = useCompanies();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Single loader — shared by mount effect, retry, and post-edit refresh.
  const loadCompany = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const found = await getCompanyById(companyId);
      if (found) {
        setCompany(found);
      } else {
        setError('Company not found');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load company');
    } finally {
      setLoading(false);
    }
  }, [companyId, getCompanyById]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  const handleBack = useCallback(() => {
    router.push('/companies');
  }, [router]);

  const handleEdit = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleSuccess = useCallback(
    () => {
      loadCompany();
    },
    [loadCompany],
  );

  // --- Loading State ---
  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" disabled className="mb-2">
          <IconArrowLeft className="mr-2 size-4" />
          Back to companies
        </Button>
        <LoadingSkeleton type="detail" />
      </div>
    );
  }

  // --- Not Found State ---
  if (error === 'Company not found' || (!loading && !company && error)) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={handleBack} className="mb-2">
          <IconArrowLeft className="mr-2 size-4" />
          Back to companies
        </Button>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="mb-1 text-lg font-semibold">Company not found</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            The company you are looking for does not exist or has been deleted.
          </p>
          <Button variant="outline" onClick={handleBack}>
            Go to Companies
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
          Back to companies
        </Button>
        <ErrorState message={error} onRetry={loadCompany} />
      </div>
    );
  }

  // Safety check
  if (!company) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleBack}>
          <IconArrowLeft className="mr-2 size-4" />
          Back to companies
        </Button>
        <Button onClick={handleEdit}>
          <IconEdit className="mr-2 size-4" />
          Edit Company
        </Button>
      </div>

      {/* Company Detail Component — company entity lifted to the page so edits
          re-render the detail without a stale fetch. */}
      <CompanyDetail companyId={companyId} company={company} onBack={handleBack} />

      {/* Edit Dialog */}
      <CompanyCreateForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
        editCompany={company}
      />
    </div>
  );
}
