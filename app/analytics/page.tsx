import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Analytics', description: 'CRM analytics and reports', path: '/analytics' });

export default function Page() {
  return <PageContent />;
}
