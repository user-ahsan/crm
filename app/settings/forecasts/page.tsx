import { createPageMetadata } from '@/lib/page-metadata';
import PageContent from './page-content';

export const metadata = createPageMetadata({ title: 'Forecasts', description: 'Sales forecasting settings', path: '/settings/forecasts' });

export default function Page() {
  return <PageContent />;
}
