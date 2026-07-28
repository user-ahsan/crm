import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Pipeline', description: 'Sales pipeline board', path: '/pipeline' });

export default function Page() {
  return <PageContent />;
}
