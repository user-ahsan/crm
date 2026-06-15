'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Tag } from '@/types/tag.types';
import { TagBadge } from '@/components/common/TagBadge';
import { useTags } from '@/hooks/useTags';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';

interface TagInputProps {
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  placeholder?: string;
  entityType?: string;
  entityId?: string;
}

export function TagInput({
  selectedTags,
  onTagsChange,
  placeholder = 'Search tags...',
}: TagInputProps) {
  const { tags, refresh } = useTags();
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refresh();
  }, []);

  const selectedIds = new Set(selectedTags.map((t) => t.id));

  const filtered = tags.filter(
    (t) =>
      !selectedIds.has(t.id) &&
      t.name.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const exactMatch = tags.find(
    (t) => t.name.toLowerCase() === inputValue.toLowerCase(),
  );
  const canCreate = inputValue.trim().length > 0 && !exactMatch;

  const addTag = useCallback(
    (tag: Tag) => {
      if (!selectedIds.has(tag.id)) {
        onTagsChange([...selectedTags, tag]);
      }
      setInputValue('');
      setHighlightIndex(-1);
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [selectedTags, onTagsChange, selectedIds],
  );

  const removeTag = useCallback(
    (tag: Tag) => {
      onTagsChange(selectedTags.filter((t) => t.id !== tag.id));
    },
    [selectedTags, onTagsChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < filtered.length + (canCreate ? 0 : -1) ? prev + 1 : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      if (highlightIndex < filtered.length) {
        addTag(filtered[highlightIndex]);
      }
    } else if (e.key === 'Enter' && canCreate && highlightIndex === -1) {
      e.preventDefault();
      const newTag: Tag = {
        id: `new-${Date.now()}`,
        name: inputValue.trim(),
        color: '#6366f1',
        createdAt: new Date().toISOString(),
      };
      addTag(newTag);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightIndex(-1);
    } else if (e.key === 'Backspace' && inputValue === '' && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div
        className={cn(
          'flex min-h-9 flex-wrap items-center gap-1.5 rounded-3xl border border-transparent bg-input/50 px-3 py-1.5 transition-[color,box-shadow,background-color]',
          'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {selectedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            name={tag.name}
            color={tag.color}
            size="sm"
            onRemove={() => removeTag(tag)}
          />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? placeholder : ''}
          className="min-w-[80px] flex-1 border-none bg-transparent py-0 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {isOpen && (filtered.length > 0 || canCreate) && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-2xl border bg-popover p-1 shadow-lg"
        >
          {filtered.map((tag, index) => (
            <button
              key={tag.id}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors',
                highlightIndex === index
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50',
              )}
              onClick={() => addTag(tag)}
              onMouseEnter={() => setHighlightIndex(index)}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors',
                highlightIndex === filtered.length
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50',
              )}
              onClick={() => {
                const newTag: Tag = {
                  id: `new-${Date.now()}`,
                  name: inputValue.trim(),
                  color: '#6366f1',
                  createdAt: new Date().toISOString(),
                };
                addTag(newTag);
              }}
              onMouseEnter={() => setHighlightIndex(filtered.length)}
            >
              <IconPlus className="size-3.5" />
              Create &quot;{inputValue.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
