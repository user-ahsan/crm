import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Email Settings', description: 'Configure email integration', path: '/settings/email' });

export default function Page() {
  return <PageContent />;
}
