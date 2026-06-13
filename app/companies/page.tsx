'use client';

import { useState, useCallback, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Company } from '@/types/company.types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { CompanyTable } from '@/components/companies/CompanyTable';
import { CompanyCreateForm } from '@/components/companies/CompanyCreateForm';
import { TagBadge } from '@/components/common/TagBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportDropdown } from '@/components/common/ExportDropdown';
import { ImportDialog } from '@/components/common/ImportDialog';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { BulkActionBar } from '@/components/common/BulkActionBar';
import { useCompanies } from '@/hooks/useCompanies';
import { useTags } from '@/hooks/useTags';
import { useCsvExport } from '@/hooks/useCsvExport';
import { useDebounce } from '@/hooks/useDebounce';
import { companyService } from '@/services/company.service';
import { tagService } from '@/services/tag.service';

/* ── Inner component with useSearchParams (requires Suspense wrapper) ── */
function CompaniesPageContent() {
  const { companies, loading, error, refresh, deleteCompany } = useCompanies();
  const { tags } = useTags();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(search, 300);
  const [tagFilter, setTagFilter] = useState<string>(searchParams.get('tag') ?? '');

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set('q', debouncedSearch);
    } else {
      params.delete('q');
    }
    if (tagFilter) {
      params.set('tag', tagFilter);
    } else {
      params.delete('tag');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [debouncedSearch, tagFilter, pathname, router, searchParams]);

  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>(undefined);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { exportEntity, isExporting } = useCsvExport();

  const filteredCompanies = useMemo(() => {
    let result = companies;
    if (debouncedSearch.trim()) {
      const s = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          c.industry?.toLowerCase().includes(s) ||
          c.location?.toLowerCase().includes(s),
      );
    }
    if (tagFilter) {
      result = result.filter((c) => c.tags.includes(tagFilter));
    }
    return result;
  }, [companies, debouncedSearch, tagFilter]);

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

  const handleBulkAction = useCallback(async (action: string, ids: string[], payload?: Record<string, string>) => {
    for (const id of ids) {
      switch (action) {
        case 'add_tag':
          if (payload?.tag) {
            const existing = companies.find((c) => c.id === id);
            if (existing && !existing.tags.includes(payload.tag)) {
              await companyService.update(id, { tags: [...existing.tags, payload.tag] });
            }
          }
          break;
        case 'delete':
          await companyService.delete(id);
          break;
      }
    }
    refresh();
  }, [refresh, companies]);

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

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-80"
          aria-label="Search companies"
        />
        <Select value={tagFilter} onValueChange={(v: string | null) => { if (v !== null) setTagFilter(v); }}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by tag">
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.name}>
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* Bulk Action Bar */}
      {selectedCompanyIds.size > 0 && (
        <BulkActionBar
          selectedIds={Array.from(selectedCompanyIds)}
          entityType="company"
          onAction={handleBulkAction}
          onClear={() => setSelectedCompanyIds(new Set())}
        />
      )}

      {/* Data Table */}
      {filteredCompanies.length > 0 && (
        <CompanyTable
          companies={filteredCompanies}
          onEdit={handleEdit}
          onDelete={handleDelete}
          selectedIds={selectedCompanyIds}
          onSelectionChange={setSelectedCompanyIds}
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

/* ── Outer wrapper — no useSearchParams here, so it can be statically rendered ── */
export default function CompaniesPage() {
  return (
    <Suspense fallback={<LoadingSkeleton type="table" count={1} />}>
      <CompaniesPageContent />
    </Suspense>
  );
}
