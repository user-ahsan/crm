import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Quotes', description: 'Manage quotes', path: '/quotes' });

export default function Page() {
  return <PageContent />;
}
