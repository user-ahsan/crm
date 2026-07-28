import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Goals', description: 'Track sales goals', path: '/goals' });

export default function Page() {
  return <PageContent />;
}
