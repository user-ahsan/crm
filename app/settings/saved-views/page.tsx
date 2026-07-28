import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Saved Views', description: 'Manage saved views', path: '/settings/saved-views' });

export default function Page() {
  return <PageContent />;
}
