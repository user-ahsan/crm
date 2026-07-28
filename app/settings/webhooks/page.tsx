import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Webhooks', description: 'Configure webhooks', path: '/settings/webhooks' });

export default function Page() {
  return <PageContent />;
}
