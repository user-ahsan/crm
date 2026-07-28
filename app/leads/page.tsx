import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Leads', description: 'Manage and track leads', path: '/leads' });

export default function Page() {
  return <PageContent />;
}
