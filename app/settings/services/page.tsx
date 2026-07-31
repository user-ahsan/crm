import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/page-metadata';
import ServicesSettingsPage from './page-content';

export const metadata: Metadata = createPageMetadata({
  title: 'Services',
  description: 'Configure and test all external services',
  path: '/settings/services',
});

export default function Page() {
  return <ServicesSettingsPage />;
}
