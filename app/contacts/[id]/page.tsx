import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return createPageMetadata({ title: `Contact #${id}`, description: 'View contact details', path: `/contacts/${id}` });
}

export default function Page() {
  return <PageContent />;
}
