'use client';

import { useState, useCallback, useMemo } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Company } from '@/types/company.types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { CompanyTable } from '@/components/companies/CompanyTable';
import { CompanyCreateForm } from '@/components/companies/CompanyCreateForm';
import { useCompanies } from '@/hooks/useCompanies';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ExportDropdown } from '@/components/common/ExportDropdown';
import { ImportDialog } from '@/components/common/ImportDialog';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { useCsvExport } from '@/hooks/useCsvExport';

export default function CompaniesPage() {
  const { companies, loading, error, refresh, deleteCompany } = useCompanies();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>(undefined);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { exportEntity, isExporting } = useCsvExport();

  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return companies;
    const s = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.industry?.toLowerCase().includes(s) ||
        c.location?.toLowerCase().includes(s),
    );
  }, [companies, search]);

  const handleEdit = useCallback(
    (id: string) => {
      const company = companies.find((c) => c.id === id);
      if (company) {
        setEditingCompany(company);
        setDialogOpen(true);
      }
    },
    [companies],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const company = companies.find((c) => c.id === id);
      if (!company) return;

      toast(`Delete ${company.name}?`, {
        description: 'This action cannot be undone.',
        duration: 5000,
        action: {
          label: 'Delete',
          onClick: async () => {
            try {
              const success = await deleteCompany(id);
              if (success) {
                toast.success('Company deleted successfully');
              } else {
                toast.error('Failed to delete company');
              }
            } catch {
              toast.error('Failed to delete company');
            }
          },
        },
      });
    },
    [companies, deleteCompany],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setTimeout(() => setEditingCompany(undefined), 300);
    }
  }, []);

  const handleCreateNew = useCallback(() => {
    setEditingCompany(undefined);
    setDialogOpen(true);
  }, []);

  const handleSuccess = useCallback((_company: Company) => {
    // The hook's internal state is already updated
  }, []);

  // --- Loading State ---
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Companies" description="Manage your company accounts" />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Companies" description="Manage your company accounts" />
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader title="Companies" description="Manage your company accounts">
        <div className="flex items-center gap-2">
          <ExportDropdown
            entityTypes={[{ key: 'companies', label: 'Companies' }]}
            onExport={exportEntity}
            isExporting={isExporting}
          />
          <PermissionGuard action="create" entity="company">
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              Import
            </Button>
          </PermissionGuard>
          <PermissionGuard action="create" entity="company">
            <Button onClick={handleCreateNew}>
              <IconPlus className="mr-2 size-4" />
              New Company
            </Button>
          </PermissionGuard>
        </div>
      </PageHeader>

      {/* Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-80"
          aria-label="Search companies"
        />
      </div>

      {/* Empty State */}
      {filteredCompanies.length === 0 && (
        <EmptyState
          title="No companies found"
          description={
            search
              ? 'Try adjusting your search to find what you are looking for.'
              : 'Get started by creating your first company.'
          }
          action={
            !search
              ? { label: 'Create Company', onClick: handleCreateNew }
              : undefined
          }
        />
      )}

      {/* Data Table */}
      {filteredCompanies.length > 0 && (
        <CompanyTable
          companies={filteredCompanies}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        entityType="companies"
        entityLabel="Companies"
        onImportComplete={refresh}
      />

      {/* Create/Edit Dialog */}
      <CompanyCreateForm
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSuccess={handleSuccess}
        editCompany={editingCompany}
      />
    </div>
  );
}
