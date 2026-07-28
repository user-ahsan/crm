import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Login', description: 'Sign in to NexusCRM', path: '/login' });

export default function Page() {
  return <PageContent />;
}
