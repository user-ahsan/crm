import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'SMS Settings', description: 'Configure SMS integration', path: '/settings/sms' });

export default function Page() {
  return <PageContent />;
}
