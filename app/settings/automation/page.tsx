import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Automation', description: 'Automation rules', path: '/settings/automation' });

export default function Page() {
  return <PageContent />;
}
