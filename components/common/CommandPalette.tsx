'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearch } from '@/hooks/useSearch';
import { Command } from '@/components/ui/command';
import {
  IconUsers,
  IconAddressBook,
  IconBuilding,
  IconCheckbox,
  IconCalendar,
  IconSearch,
} from '@tabler/icons-react';

type ResultType = 'lead' | 'contact' | 'company' | 'task' | 'meeting';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  lead: <IconUsers className="h-4 w-4" />,
  contact: <IconAddressBook className="h-4 w-4" />,
  company: <IconBuilding className="h-4 w-4" />,
  task: <IconCheckbox className="h-4 w-4" />,
  meeting: <IconCalendar className="h-4 w-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  lead: 'Leads',
  contact: 'Contacts',
  company: 'Companies',
  task: 'Tasks',
  meeting: 'Meetings',
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { query, setQuery, grouped, results } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const flatResults = results;
  const groupKeys = Object.keys(grouped);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIndex(0);
    }
  }, [open, setQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) onClose();
      }
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
        e.preventDefault();
        router.push(flatResults[selectedIndex].href);
        onClose();
      }
    },
    [flatResults, selectedIndex, router, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search leads, contacts, companies"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg">
        <Command className="rounded-lg border shadow-2xl">
          <div className="flex items-center border-b px-3">
            <IconSearch className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search leads, contacts, companies..."
              className="flex h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="ml-auto hidden rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
              ESC
            </kbd>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {query.length > 0 && flatResults.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found for &quot;{query}&quot;
              </div>
            )}
            {query.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Start typing to search across all entities
              </div>
            )}
              <div role="listbox">
                {groupKeys.map((type) => (
                  <div key={type}>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {TYPE_ICONS[type]}
                      {TYPE_LABELS[type] ?? type}
                      <span className="ml-auto text-[10px]">({grouped[type].length})</span>
                    </div>
                    {grouped[type].map((result) => {
                      const globalIdx = flatResults.indexOf(result);
                      return (
                        <div
                          key={result.id}
                          role="option"
                          aria-selected={globalIdx === selectedIndex}
                          className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                            globalIdx === selectedIndex ? 'bg-accent text-accent-foreground' : ''
                          }`}
                          onClick={() => {
                            router.push(result.href);
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                            {TYPE_ICONS[type]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{result.title}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {result.subtitle}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
          </div>
          <div className="border-t p-2 text-[10px] text-muted-foreground">
            <span className="mr-3">↑↓ Navigate</span>
            <span className="mr-3">↵ Open</span>
            <span>Esc Close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

export default CommandPalette;
