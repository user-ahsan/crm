import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Settings', description: 'CRM settings', path: '/settings' });

export default function Page() {
  return <PageContent />;
}
