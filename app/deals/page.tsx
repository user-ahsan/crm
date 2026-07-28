import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Deals', description: 'Manage deals', path: '/deals' });

export default function Page() {
  return <PageContent />;
}
