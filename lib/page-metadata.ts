import type { Metadata } from 'next';

interface PageMetadataOptions {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'profile';
}

export function createPageMetadata({ title, description, path, ogImage, ogType = 'website' }: PageMetadataOptions): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexuscrm.com';
  const url = path ? `${baseUrl}${path}` : baseUrl;

  return {
    title: `${title} | NexusCRM`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | NexusCRM`,
      description,
      url,
      siteName: 'NexusCRM',
      type: ogType,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | NexusCRM`,
      description,
    },
  };
}
