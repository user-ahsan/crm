import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Data Quality', description: 'Data quality settings', path: '/settings/data-quality' });

export default function Page() {
  return <PageContent />;
}
