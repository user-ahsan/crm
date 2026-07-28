'use client';

import { useState } from 'react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { InvoicePDF } from './InvoicePDF';
import type { Invoice } from '@/types/invoice.types';
import type { InvoiceTemplate } from '@/types/invoice.types';
import { Button } from '@/components/ui/button';

const defaultTemplate: InvoiceTemplate = {
  id: 'default',
  name: 'Default',
  primaryColor: '#1e293b',
  accentColor: '#3b82f6',
  companyName: '',
  companyAddress: '',
  companyEmail: '',
  companyPhone: '',
  footer: 'Thank you for your business!',
  paymentTerms: 'net-30',
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
import { IconDownload, IconEye, IconLoader2 } from '@tabler/icons-react';

interface InvoiceDownloadButtonProps {
  invoice: Invoice;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showPreview?: boolean;
}

export function InvoiceDownloadButton({
  invoice,
  label = 'Download PDF',
  variant = 'outline',
  size = 'sm',
  showPreview = false,
}: InvoiceDownloadButtonProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const template = defaultTemplate;

  return (
    <>
      <div className="flex items-center gap-2">
        <PDFDownloadLink
          document={<InvoicePDF invoice={invoice} template={template} />}
          fileName={`${invoice.invoiceNumber}.pdf`}
        >
          {({ loading }) => (
            <Button variant={variant} size={size} disabled={loading}>
              {loading ? (
                <IconLoader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <IconDownload className="mr-1.5 size-4" />
              )}
              {loading ? 'Generating...' : label}
            </Button>
          )}
        </PDFDownloadLink>

        {showPreview && (
          <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
            <IconEye className="mr-1.5 size-4" />
            Preview
          </Button>
        )}
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="h-[90vh] w-[90vw] max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-medium">{invoice.invoiceNumber}</span>
              <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
            </div>
            <PDFViewer style={{ width: '100%', height: 'calc(100% - 40px)' }}>
              <InvoicePDF invoice={invoice} template={template} />
            </PDFViewer>
          </div>
        </div>
      )}
    </>
  );
}
