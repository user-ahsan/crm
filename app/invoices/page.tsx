import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Invoices', description: 'Manage invoices', path: '/invoices' });

export default function Page() {
  return <PageContent />;
}
