import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexuscrm.com';

  const routes = [
    '', '/dashboard', '/leads', '/contacts', '/companies', '/deals',
    '/pipeline', '/tasks', '/meetings', '/analytics', '/campaigns',
    '/invoices', '/quotes', '/goals', '/tags',
    '/settings', '/settings/team', '/settings/api-keys', '/settings/automation',
    '/settings/data-quality', '/settings/email', '/settings/forecasts',
    '/settings/integrations', '/settings/invoice-templates', '/settings/portal',
    '/settings/saved-views', '/settings/sms', '/settings/webhooks',
    '/settings/workflows',
    '/onboarding',
  ].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route.startsWith('/settings') ? ('monthly' as const) : ('daily' as const),
    priority: route === '' ? 1.0 : route.startsWith('/settings') ? 0.3 : route === '/onboarding' ? 0.3 : 0.8,
  }));

  return routes;
}
