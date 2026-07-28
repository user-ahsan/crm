import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return createPageMetadata({ title: `Company #${id}`, description: 'View company details', path: `/companies/${id}` });
}

export default function Page() {
  return <PageContent />;
}
