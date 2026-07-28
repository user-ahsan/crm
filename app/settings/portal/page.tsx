import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Portal Settings', description: 'Client portal configuration', path: '/settings/portal' });

export default function Page() {
  return <PageContent />;
}
