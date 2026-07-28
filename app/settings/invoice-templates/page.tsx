import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Invoice Templates', description: 'Configure invoice templates', path: '/settings/invoice-templates' });

export default function Page() {
  return <PageContent />;
}
