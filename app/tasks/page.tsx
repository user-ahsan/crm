import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Tasks', description: 'Manage tasks', path: '/tasks' });

export default function Page() {
  return <PageContent />;
}
