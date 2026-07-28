import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'API Keys', description: 'Manage API keys', path: '/settings/api-keys' });

export default function Page() {
  return <PageContent />;
}
