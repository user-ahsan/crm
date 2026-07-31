'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IconBolt } from '@tabler/icons-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * SMS settings have moved to the unified Services page.
 * This page redirects to /settings/services.
 */
export default function SmsSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/services');
  }, [router]);

  return (
    <div className="flex items-center justify-center p-12">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <IconBolt size={32} className="text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            SMS settings have moved to the{' '}
            <a href="/settings/services" className="font-medium text-primary hover:underline">
              unified Services page
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
