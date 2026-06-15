'use client';

import { useState, useEffect } from 'react';

interface NoteEditorProps {
  initialTitle?: string;
  initialBody?: string;
  onSave: (title: string, body: string) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export function NoteEditor({ initialTitle = '', initialBody = '', onSave, onCancel, saving: externalSaving }: NoteEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [internalSaving, setInternalSaving] = useState(false);
  const saving = externalSaving ?? internalSaving;
  const isDirty = title !== initialTitle || body !== initialBody;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTitle(initialTitle);
    setBody(initialBody);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialTitle, initialBody]);

  const handleSave = async () => {
    if (!body.trim()) return;
    setInternalSaving(true);
    try {
      await onSave(title, body);
    } finally {
      setInternalSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4" onKeyDown={handleKeyDown}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title (optional)"
        className="w-full border-0 border-b border-transparent bg-transparent pb-1 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-border"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your note here... Supports **Markdown** formatting."
        rows={6}
        className="w-full resize-y rounded-md border bg-background p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Markdown supported. {saving ? 'Saving...' : `${body.length} chars`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex items-center rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!body.trim() || saving || (!isDirty && !!initialBody)}
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Saving...' : initialBody ? 'Update Note' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}
