'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IconArrowLeft, IconEdit } from '@tabler/icons-react';
import type { Contact } from '@/types/contact.types';
import { contactService } from '@/services/contact.service';
import { ContactDetail } from '@/components/contacts/ContactDetail';
import { ContactCreateForm } from '@/components/contacts/ContactCreateForm';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadContact = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const found = await contactService.getById(contactId);
      if (found) {
        setContact(found);
      } else {
        setError('Contact not found');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await contactService.getById(contactId);
        if (cancelled) return;
        if (data) {
          setContact(data);
        } else {
          setError('Contact not found');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load contact');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contactId]);

  const handleBack = useCallback(() => {
    router.push('/contacts');
  }, [router]);

  const handleEdit = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleSuccess = useCallback(
    (_updatedContact: Contact) => {
      loadContact();
    },
    [loadContact],
  );

  // --- Loading State ---
  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" disabled className="mb-2">
          <IconArrowLeft className="mr-2 size-4" />
          Back to contacts
        </Button>
        <LoadingSkeleton type="detail" />
      </div>
    );
  }

  // --- Not Found State ---
  if (error === 'Contact not found' || (!loading && !contact && error)) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={handleBack} className="mb-2">
          <IconArrowLeft className="mr-2 size-4" />
          Back to contacts
        </Button>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="mb-1 text-lg font-semibold">Contact not found</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            The contact you are looking for does not exist or has been deleted.
          </p>
          <Button variant="outline" onClick={handleBack}>
            Go to Contacts
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
          Back to contacts
        </Button>
        <ErrorState message={error} onRetry={loadContact} />
      </div>
    );
  }

  // Safety check
  if (!contact) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleBack}>
          <IconArrowLeft className="mr-2 size-4" />
          Back to contacts
        </Button>
        <Button onClick={handleEdit}>
          <IconEdit className="mr-2 size-4" />
          Edit Contact
        </Button>
      </div>

      {/* Contact Detail Component */}
      <ContactDetail contactId={contactId} onBack={handleBack} />

      {/* Edit Dialog */}
      <ContactCreateForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
        editContact={contact}
      />
    </div>
  );
}
