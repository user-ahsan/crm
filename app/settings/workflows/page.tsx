import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Workflows', description: 'Automation workflows', path: '/settings/workflows' });

export default function Page() {
  return <PageContent />;
}
