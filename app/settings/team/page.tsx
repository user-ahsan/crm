import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Team Settings', description: 'Manage team members', path: '/settings/team' });

export default function Page() {
  return <PageContent />;
}
