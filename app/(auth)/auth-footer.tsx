'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Client component that shows the custom logo or falls back to "NexusCRM" text.
 */
export function AuthFooter() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/branding')
      .then(r => r.json())
      .then(json => {
        if (!cancelled && json.success && json.data?.logo_url) {
          setLogoUrl(json.data.logo_url);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <footer className="absolute bottom-6 text-center text-xs text-muted-foreground/60">
      <Link href="/" className="transition-colors hover:text-muted-foreground/90">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" className="mx-auto max-h-6 max-w-32 rounded object-contain" />
        ) : (
          '© NexusCRM'
        )}
      </Link>
    </footer>
  );
}
