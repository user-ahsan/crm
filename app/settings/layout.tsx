import { ReactNode } from 'react';
import Link from 'next/link';
import { IconUsers, IconKey, IconRobot, IconShieldCheck, IconMail, IconChartBar, IconPlugConnected, IconFileText, IconUserShield, IconEye, IconMessage, IconWebhook, IconSettings, IconGitBranch } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'General', href: '/settings', icon: <IconSettings className="size-4" /> },
  { label: 'Account', href: '/settings', icon: <IconUserShield className="size-4" /> },
  { label: 'Team', href: '/settings/team', icon: <IconUsers className="size-4" /> },
  { label: 'API Keys', href: '/settings/api-keys', icon: <IconKey className="size-4" /> },
  { label: 'Automation', href: '/settings/automation', icon: <IconRobot className="size-4" /> },
  { label: 'Data Quality', href: '/settings/data-quality', icon: <IconShieldCheck className="size-4" /> },
  { label: 'Email', href: '/settings/email', icon: <IconMail className="size-4" /> },
  { label: 'SMS', href: '/settings/sms', icon: <IconMessage className="size-4" /> },
  { label: 'Forecasts', href: '/settings/forecasts', icon: <IconChartBar className="size-4" /> },
  { label: 'Integrations', href: '/settings/integrations', icon: <IconPlugConnected className="size-4" /> },
  { label: 'Invoice Templates', href: '/settings/invoice-templates', icon: <IconFileText className="size-4" /> },
  { label: 'Portal', href: '/settings/portal', icon: <IconUserShield className="size-4" /> },
  { label: 'Saved Views', href: '/settings/saved-views', icon: <IconEye className="size-4" /> },
  { label: 'Webhooks', href: '/settings/webhooks', icon: <IconWebhook className="size-4" /> },
  { label: 'Workflows', href: '/settings/workflows', icon: <IconGitBranch className="size-4" /> },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-6 p-6">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 md:block">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
