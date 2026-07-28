import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Meetings', description: 'Schedule and view meetings', path: '/meetings' });

export default function Page() {
  return <PageContent />;
}
