import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Campaigns', description: 'Marketing campaigns', path: '/campaigns' });

export default function Page() {
  return <PageContent />;
}
