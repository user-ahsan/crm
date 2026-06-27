import React from 'react';
import { Document, Page, View, Text, StyleSheet, Font, Image } from '@react-pdf/renderer';
import type { Invoice, InvoiceTemplate } from '@/types/invoice.types';
import { formatCurrency } from '@/lib/formatters';

// Register a clean font
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2JL7W0Q5n-wU.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa0ZL7W0Q5n-wU.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5n-wU.woff2', fontWeight: 700 },
  ],
});

const createStyles = (primaryColor: string, accentColor: string) => StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: accentColor,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
    color: primaryColor,
    marginBottom: 4,
  },
  companyDetail: {
    fontSize: 9,
    color: '#64748b',
    lineHeight: 1.5,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: primaryColor,
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 12,
    color: accentColor,
    fontWeight: 600,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  infoBlock: {
    flex: 1,
  },
  infoBlockRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  infoLabel: {
    fontSize: 8,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 10,
    color: '#1e293b',
    marginBottom: 2,
  },
  billToLabel: {
    fontSize: 8,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  billToName: {
    fontSize: 11,
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: primaryColor,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 0,
  },
  tableHeaderText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableColDescription: { flex: 4 },
  tableColQty: { flex: 1, textAlign: 'right' },
  tableColPrice: { flex: 1.5, textAlign: 'right' },
  tableColTotal: { flex: 1.5, textAlign: 'right' },
  tableCell: {
    fontSize: 9,
    color: '#475569',
  },
  tableCellDescription: {
    fontSize: 9,
    color: '#1e293b',
    fontWeight: 500,
  },
  totalsSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 9,
    color: '#64748b',
    width: 100,
    textAlign: 'right',
    marginRight: 40,
  },
  totalValue: {
    fontSize: 9,
    color: '#1e293b',
    width: 90,
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: primaryColor,
    width: 100,
    textAlign: 'right',
    marginRight: 40,
  },
  grandTotalValue: {
    fontSize: 11,
    fontWeight: 700,
    color: primaryColor,
    width: 90,
    textAlign: 'right',
  },
  notesSection: {
    marginTop: 30,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 8,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusDraft: { backgroundColor: '#f1f5f9', color: '#64748b' },
  statusPaid: { backgroundColor: '#dcfce7', color: '#16a34a' },
  statusOverdue: { backgroundColor: '#fef2f2', color: '#dc2626' },
  statusCancelled: { backgroundColor: '#f1f5f9', color: '#94a3b8' },
  statusRefunded: { backgroundColor: '#fef3c7', color: '#d97706' },
  logo: {
    width: 120,
    height: 40,
    objectFit: 'contain',
    marginBottom: 8,
  },
  logoPlaceholder: {
    width: 120,
    height: 40,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    fontSize: 8,
    color: '#94a3b8',
  },
});

function getStatusStyle(status: string, styles: ReturnType<typeof createStyles>) {
  switch (status) {
    case 'paid': return styles.statusPaid;
    case 'overdue': return styles.statusOverdue;
    case 'cancelled': return styles.statusCancelled;
    case 'refunded': return styles.statusRefunded;
    default: return styles.statusDraft;
  }
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

interface InvoicePDFProps {
  invoice: Invoice;
  template?: InvoiceTemplate;
}

export function InvoicePDF({ invoice, template }: InvoicePDFProps) {
  const primaryColor = template?.primaryColor || '#1e293b';
  const accentColor = template?.accentColor || '#3b82f6';
  const styles = createStyles(primaryColor, accentColor);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with logo and invoice title */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {template?.headerLogo ? (
              <Image style={styles.logo} src={template.headerLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>COMPANY LOGO</Text>
              </View>
            )}
            <Text style={styles.companyName}>{template?.companyName || 'Company Name'}</Text>
            <Text style={styles.companyDetail}>{template?.companyAddress || ''}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <View style={{ marginTop: 6 }}>
              <Text style={[styles.statusBadge, getStatusStyle(invoice.status, styles)]}>
                {invoice.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Info section: bill to + invoice details */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.billToLabel}>Bill To</Text>
            <Text style={styles.billToName}>Client Name</Text>
            <Text style={styles.companyDetail}>client@company.com</Text>
          </View>
          <View style={styles.infoBlockRight}>
            <Text style={styles.infoLabel}>Invoice Date</Text>
            <Text style={styles.infoValue}>{formatDate(invoice.createdAt)}</Text>
            <View style={{ height: 8 }} />
            <Text style={styles.infoLabel}>Due Date</Text>
            <Text style={styles.infoValue}>{formatDate(invoice.dueDate)}</Text>
            <View style={{ height: 8 }} />
            <Text style={styles.infoLabel}>Payment Terms</Text>
            <Text style={styles.infoValue}>{(invoice.paymentTerms || 'net-30').replace('net-', 'Net ')}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.tableColDescription]}>Description</Text>
          <Text style={[styles.tableHeaderText, styles.tableColQty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.tableColPrice]}>Unit Price</Text>
          <Text style={[styles.tableHeaderText, styles.tableColTotal]}>Amount</Text>
        </View>

        {/* Table rows */}
        {invoice.items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.tableCellDescription, styles.tableColDescription]}>{item.description}</Text>
            <Text style={[styles.tableCell, styles.tableColQty]}>{item.quantity}</Text>
            <Text style={[styles.tableCell, styles.tableColPrice]}>{formatCurrency(item.unitPrice)}</Text>
            <Text style={[styles.tableCell, styles.tableColTotal]}>{formatCurrency(item.total)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          {invoice.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={styles.totalValue}>-{formatCurrency(invoice.discount)}</Text>
            </View>
          )}
          {invoice.taxRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({(invoice.taxRate * 100).toFixed(0)}%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.tax)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Due</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {template?.footer || 'Thank you for your business!'}
          </Text>
          <Text style={[styles.footerText, { marginTop: 4 }]}>
            {template?.companyEmail} | {template?.companyPhone}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
