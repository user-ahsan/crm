'use client';

import { useState, useCallback, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ContactsPage() {
  const { contacts, loading, error, refresh, deleteContact } = useContacts();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const s = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.jobTitle?.toLowerCase().includes(s) ||
        c.tags.some((t) => t.toLowerCase().includes(s)),
    );
  }, [contacts, search]);

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

  const handleSuccess = useCallback((_contact: Contact) => {
    // The hook's internal state is already updated
  }, []);

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
        <Button onClick={handleCreateNew}>
          <IconPlus className="mr-2 size-4" />
          New Contact
        </Button>
      </PageHeader>

      {/* Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-80"
          aria-label="Search contacts"
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

      {/* Data Table */}
      {filteredContacts.length > 0 && (
        <ContactTable
          contacts={filteredContacts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

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
