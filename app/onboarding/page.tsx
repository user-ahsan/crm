import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Onboarding', description: 'Get started with NexusCRM', path: '/onboarding' });

export default function Page() {
  return <PageContent />;
}
