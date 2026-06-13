'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  IconNetwork,
  IconUsers,
  IconColumns3,
  IconBrain,
  IconCalendarEvent,
  IconCheckbox,
  IconChartBar,
  IconArrowRight,
  IconChevronRight,
} from '@tabler/icons-react';

/* ── Feature data ────────────────────────────────────────── */
interface Feature {
  icon: typeof IconUsers;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: IconUsers,
    title: 'Lead Management',
    description:
      'Capture, track, and qualify leads from multiple sources with intelligent prioritization and automated workflows.',
  },
  {
    icon: IconColumns3,
    title: 'Sales Pipeline',
    description:
      'Visual Kanban pipeline that moves deals through stages from new to won, with drag-and-drop simplicity.',
  },
  {
    icon: IconBrain,
    title: 'Contact Intelligence',
    description:
      'Unified contact profiles with rich history, social links, and relationship mapping for deeper insights.',
  },
  {
    icon: IconCalendarEvent,
    title: 'Meeting Scheduling',
    description:
      'Schedule, manage, and track meetings with calendar integration and automated reminders.',
  },
  {
    icon: IconCheckbox,
    title: 'Task Execution',
    description:
      'Assign, prioritize, and track tasks with deadlines, ensuring nothing falls through the cracks.',
  },
  {
    icon: IconChartBar,
    title: 'Analytics Dashboard',
    description:
      'Real-time metrics, conversion reports, and revenue forecasting to drive data-informed decisions.',
  },
];

/* ── Landing Page ────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Header / Nav ───────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
              <IconNetwork className="size-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Nexus<span className="text-muted-foreground">CRM</span>
            </span>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push('/login')}
            >
              Sign In
              <IconArrowRight className="size-4" />
            </Button>
          </nav>

          <Button
            variant="default"
            size="sm"
            className="md:hidden"
            onClick={() => router.push('/login')}
          >
            Sign In
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero Section ─────────────────────────────── */}
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8 lg:pb-36 lg:pt-32">
          {/* Background gradients */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3">
              <div className="size-[600px] rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-60 blur-3xl" />
            </div>
            <div className="absolute bottom-0 right-0">
              <div className="size-[400px] rounded-full bg-gradient-to-tl from-primary/5 via-transparent to-transparent opacity-40 blur-3xl" />
            </div>
          </div>

          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              Now available — v1.0
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Unified Sales &{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Relationship
              </span>{' '}
              Management
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              NexusCRM brings together leads, contacts, pipeline, tasks, and
              analytics into one powerful platform. Turn relationships into
              revenue with intelligent tools designed for modern sales teams.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => router.push('/login')}
              >
                Get Started
                <IconChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => {
                  const el = document.getElementById('features');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Explore Features
              </Button>
            </div>
          </div>
        </section>

        {/* ── Features Section ─────────────────────────── */}
        <section
          id="features"
          className="border-t border-border/40 bg-muted/20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to{' '}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  grow smarter
                </span>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Powerful tools that work together to help you manage leads, close
                deals, and build lasting customer relationships.
              </p>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={feature.title}
                    className="group transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <CardContent className="flex flex-col items-start gap-4 p-6">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/10 transition-colors group-hover:from-primary/15 group-hover:to-primary/10">
                        <Icon className="size-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold">
                          {feature.title}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CTA Section ──────────────────────────────── */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to transform your sales workflow?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Join thousands of sales professionals who use NexusCRM to close
              more deals and build stronger relationships.
            </p>
            <Button
              size="lg"
              className="mt-8"
              onClick={() => router.push('/login')}
            >
              Get Started Free
              <IconChevronRight className="size-4" />
            </Button>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <IconNetwork className="size-4" />
            <span className="font-medium">
              Nexus<span className="text-foreground">CRM</span>
            </span>
          </div>
          <p>&copy; {new Date().getFullYear()} NexusCRM. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
