import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Companies', description: 'Manage companies', path: '/companies' });

export default function Page() {
  return <PageContent />;
}
