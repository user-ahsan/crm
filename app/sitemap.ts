import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexuscrm.com';

  const routes = [
    '',
  ].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: ('weekly' as const),
    priority: route === '' ? 1.0 : 0.8,
  }));

  return routes;
}
