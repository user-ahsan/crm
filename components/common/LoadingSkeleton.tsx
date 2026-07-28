'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type SkeletonVariant = 'table' | 'card' | 'list' | 'detail' | 'form' | 'chart' | 'kanban';

interface LoadingSkeletonProps {
  type: SkeletonVariant;
  count?: number;
  className?: string;
}

const DEFAULT_COUNTS: Record<SkeletonVariant, number> = {
  table: 3,
  card: 1,
  list: 3,
  detail: 1,
  form: 1,
  chart: 1,
  kanban: 1,
};

function TableSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 border-b pb-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          <Skeleton className="mb-2 h-8 w-24" />
          <Skeleton className="h-4 w-36" />
        </div>
      ))}
    </div>
  );
}

function ListSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-32" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <Skeleton className="h-[300px] w-full rounded-lg" />
      <div className="flex gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, col) => (
        <div key={col} className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 4 }).map((_, card) => (
            <div key={card} className="rounded-md border bg-background p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const SKELETON_MAP: Record<
  SkeletonVariant,
  ({ count }: { count: number }) => React.ReactElement
> = {
  table: TableSkeleton,
  card: CardSkeleton,
  list: ListSkeleton,
  detail: DetailSkeleton,
  form: FormSkeleton,
  chart: ChartSkeleton,
  kanban: KanbanSkeleton,
};

export function LoadingSkeleton({
  type,
  count,
  className,
}: LoadingSkeletonProps) {
  const resolvedCount = count ?? DEFAULT_COUNTS[type];
  const Component = SKELETON_MAP[type];

  return (
    <div className={cn('animate-pulse', className)}>
      <Component count={resolvedCount} />
    </div>
  );
}

export default LoadingSkeleton;
