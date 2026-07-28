import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'New Invoice', description: 'Create a new invoice', path: '/invoices/new' });

export default function Page() {
  return <PageContent />;
}
