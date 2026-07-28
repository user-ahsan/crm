import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Sign Up', description: 'Create an account', path: '/signup' });

export default function Page() {
  return <PageContent />;
}
