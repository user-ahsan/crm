'use client';

import { cn } from '@/lib/utils';

interface LeadScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const scoreColor = (score: number): string => {
  if (score <= 30) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
  if (score <= 60) return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
  if (score <= 80) return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
  return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
};

export function LeadScoreBadge({ score, size = 'sm', showLabel = false }: LeadScoreBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-semibold tabular-nums',
        scoreColor(score),
        size === 'sm' && 'h-6 min-w-[2rem] px-1.5 text-[11px]',
        size === 'md' && 'h-7 min-w-[2.5rem] px-2 text-xs',
        size === 'lg' && 'h-10 min-w-[3.5rem] px-3 text-sm',
      )}
      title={`Lead score: ${score}/100`}
    >
      {score}
      {showLabel && <span className="ml-1 font-normal">/100</span>}
    </span>
  );
}
