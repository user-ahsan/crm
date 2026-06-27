'use client';

import { useState, useCallback, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { Contact } from '@/types/contact.types';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ContactTable } from '@/components/contacts/ContactTable';
import { ContactCreateForm } from '@/components/contacts/ContactCreateForm';

import { useContacts } from '@/hooks/useContacts';
import { useTags } from '@/hooks/useTags';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportDropdown } from '@/components/common/ExportDropdown';
import { ImportDialog } from '@/components/common/ImportDialog';
import { PermissionGuard } from '@/components/teams/PermissionGuard';
import { BulkActionBar } from '@/components/common/BulkActionBar';
import { ViewsDropdown } from '@/components/common/ViewsDropdown';
import { useCsvExport } from '@/hooks/useCsvExport';
import { contactService } from '@/services/contact.service';

import { convertToCSV, downloadCSV } from '@/lib/csv-export';
import { CONTACT_EXPORT_COLUMNS } from '@/lib/csv-export-definitions';
import type { SavedView } from '@/types/saved-view.types';

function ContactsPageContent() {
  const { contacts, loading, error, refresh, deleteContact } = useContacts();
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

  const handleLoadView = useCallback((view: SavedView) => {
    const f = view.filters as Record<string, string>;
    setSearch(f.search ?? '');
    setTagFilter(f.tag ?? '');
  }, []);

  const currentViewFilters = useMemo(() => ({
    search,
    tag: tagFilter,
  }), [search, tagFilter]);

  const hasActiveFilters = !!(search || tagFilter);

  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);

  // Auto-open create dialog when navigated from Quick Actions
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDialogOpen(true);
    }
  }, [searchParams]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { exportEntity, isExporting } = useCsvExport();

  const filteredContacts = useMemo(() => {
    let result = contacts;
    if (debouncedSearch.trim()) {
      const s = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          c.email?.toLowerCase().includes(s) ||
          c.jobTitle?.toLowerCase().includes(s) ||
          c.tags.some((t) => t.toLowerCase().includes(s)),
      );
    }
    if (tagFilter) {
      result = result.filter((c) => c.tags.includes(tagFilter));
    }
    return result;
  }, [contacts, debouncedSearch, tagFilter]);

  const handleEdit = useCallback(
    (id: string) => {
      const contact = contacts.find((c) => c.id === id);
      if (contact) {
        setEditingContact(contact);
        setDialogOpen(true);
      }
    },
    [contacts],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const contact = contacts.find((c) => c.id === id);
      if (!contact) return;

      toast(`Delete ${contact.name}?`, {
        description: 'This action cannot be undone.',
        duration: 5000,
        action: {
          label: 'Delete',
          onClick: async () => {
            try {
              const success = await deleteContact(id);
              if (success) {
                toast.success('Contact deleted successfully');
              } else {
                toast.error('Failed to delete contact');
              }
            } catch {
              toast.error('Failed to delete contact');
            }
          },
        },
      });
    },
    [contacts, deleteContact],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setTimeout(() => setEditingContact(undefined), 300);
    }
  }, []);

  const handleCreateNew = useCallback(() => {
    setEditingContact(undefined);
    setDialogOpen(true);
  }, []);

  const handleSuccess = useCallback(() => {
    // The hook's internal state is already updated
  }, []);

  // ── Bulk action handlers ──────────────────────────────────────────

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      await contactService.delete(id);
    }
    refresh();
  }, [refresh]);

  const handleBulkTag = useCallback(async (ids: string[], tagNames: string[]) => {
    for (const id of ids) {
      const existing = contacts.find((c) => c.id === id);
      if (existing) {
        const merged = [...new Set([...existing.tags, ...tagNames])];
        await contactService.update(id, { tags: merged });
      }
    }
    refresh();
  }, [refresh, contacts]);

  const handleBulkExport = useCallback((ids: string[]) => {
    const selected = filteredContacts.filter((c) => ids.includes(c.id));
    if (selected.length === 0) {
      toast.error('No contacts to export');
      return;
    }
    const csv = convertToCSV(selected as any, CONTACT_EXPORT_COLUMNS);
    const filename = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(csv, filename);
    toast.success(`Exported ${selected.length} contact${selected.length !== 1 ? 's' : ''}`);
  }, [filteredContacts]);

  // --- Loading State ---
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Contacts" description="Manage your contact relationships" />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Contacts" description="Manage your contact relationships" />
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader title="Contacts" description="Manage your contact relationships">
        <div className="flex items-center gap-2">
          <ExportDropdown
            entityTypes={[{ key: 'contacts', label: 'Contacts' }]}
            onExport={exportEntity}
            isExporting={isExporting}
          />
          <PermissionGuard action="create" entity="contact">
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              Import
            </Button>
          </PermissionGuard>
          <PermissionGuard action="create" entity="contact">
            <Button onClick={handleCreateNew}>
              <IconPlus className="mr-2 size-4" />
              New Contact
            </Button>
          </PermissionGuard>
        </div>
      </PageHeader>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-80"
          aria-label="Search contacts"
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
        <ViewsDropdown
          entityType="contact"
          currentFilters={currentViewFilters}
          onLoadView={handleLoadView}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {/* Empty State */}
      {filteredContacts.length === 0 && (
        <EmptyState
          title="No contacts found"
          description={
            search
              ? 'Try adjusting your search to find what you are looking for.'
              : 'Get started by creating your first contact.'
          }
          action={
            !search
              ? { label: 'Create Contact', onClick: handleCreateNew }
              : undefined
          }
        />
      )}

      {/* Bulk Action Bar */}
      {selectedContactIds.size > 0 && (
        <BulkActionBar
          selectedIds={selectedContactIds}
          entityType="contact"
          onBulkDelete={handleBulkDelete}
          onBulkTag={handleBulkTag}
          onBulkExport={handleBulkExport}
          tags={tags}
          onClear={() => setSelectedContactIds(new Set())}
        />
      )}

      {/* Data Table */}
      {filteredContacts.length > 0 && (
        <ContactTable
          contacts={filteredContacts}
          onEdit={handleEdit}
          onDelete={handleDelete}
          selectedIds={selectedContactIds}
          onSelectionChange={setSelectedContactIds}
        />
      )}

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        entityType="contacts"
        entityLabel="Contacts"
        onImportComplete={refresh}
      />

      {/* Create/Edit Dialog */}
      <ContactCreateForm
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSuccess={handleSuccess}
        editContact={editingContact}
      />
    </div>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton type="table" count={1} />}>
      <ContactsPageContent />
    </Suspense>
  );
}
