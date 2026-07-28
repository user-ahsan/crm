import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return createPageMetadata({ title: `Invoice #${id}`, description: 'View invoice details', path: `/invoices/${id}` });
}

export default function Page() {
  return <PageContent />;
}
