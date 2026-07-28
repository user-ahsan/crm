import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Dashboard', description: 'CRM dashboard overview', path: '/dashboard' });

export default function Page() {
  return <PageContent />;
}
